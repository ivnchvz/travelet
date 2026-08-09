import { AddCategoryModal } from '@/components/AddCategoryModal';
import { CloudBackground } from '@/components/CloudBackground';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { SampleDocumentPrompt } from '@/components/SampleDocumentPrompt';
import { addSampleDocument } from '@/services/SampleDocument';
import { BarcodeSheet, PassItem } from '@/components/physical/BarcodeSheet';
import { StampBook } from '@/components/physical/StampBook';
import { ArchTitle } from '@/components/ArchTitle';
import { CategoryObject } from '@/components/physical/CategoryObject';
import { DeclareObject } from '@/components/physical/DeclareObject';
import { DocumentPeek } from '@/components/physical/DocumentPeek';
import { PageViewer } from '@/components/physical/PageViewer';
import { getObjectType, OBJECT_SPECS, ObjectType } from '@/components/physical/theme';
import { PDFViewer } from '@/components/PDFViewer';
import * as IslandService from '@/services/IslandService';
import { hasSeenOnboarding, markOnboardingSeen, saveOnboardingProfile } from '@/services/OnboardingService';
import { syncFlightReminders } from '@/services/FlightReminders';
import { warmPdfInsights } from '@/services/PDFTextService';
import { getSkyPalette } from '@/services/SkyService';
import PDFService, { PDFCategory, PDFDocument } from '@/services/PDFService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, InteractionManager, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * What the arch over each object reads.
 *
 * Keyed on the built-in ids rather than on the object type, because the type is
 * also guessed from a category's name — a folder somebody calls "spare
 * passports" is drawn as a passport, and it should still be titled with the
 * name they gave it rather than relabelled "Passports".
 */
const SHELF_TITLES: Record<string, string> = {
  passports: 'Passports',
  'boarding-passes': 'Flight tickets',
  evisas: 'Visas',
  insurance: 'Insurances',
};

/**
 * Long enough for a real folder name, short enough that the arch keeps its
 * curve — the letters are laid along a fixed radius, so a title that runs on
 * wraps past the quarter turn and starts coming back down the other side.
 */
const TITLE_LIMIT = 15;

/**
 * What rides on the shelf.
 *
 * A union rather than `any`: only one of these carries a category, and the
 * height of the object under a title is worked out from that category. Left
 * loose, the add-a-folder card reached the same code and the shelf crashed
 * reading `id` off nothing.
 */
type ShelfItem =
  | { type: 'declare'; id: string }
  | { type: 'category'; id: string; category: PDFCategory }
  | { type: 'add'; id: string };

/** Item padding, matching `carouselItemContainer`. */
const ITEM_PAD_X = 10;
const ITEM_PAD_Y = 6;
/** Clear air between the foot of the arch and the top edge of the object. */
const TITLE_GAP = 14;
/** The declaration sheet's own proportions, from `DeclareObject`. */
const DECLARE_WIDTH_PCT = 0.88;
const DECLARE_ASPECT = 0.76;

/**
 * How tall the object under the title actually draws.
 *
 * Every object centres its cover inside whatever box it is given, so the top of
 * the cover sits half the leftover height down — which is why a title pinned to
 * the top of the item floated a long way clear of a small object like the
 * passport. Working the height out here lets the arch sit the same short
 * distance above every cover instead of the same distance above the screen.
 */
function coverHeight(item: ShelfItem, itemWidth: number): number {
  const inner = itemWidth - ITEM_PAD_X * 2;
  if (item.type === 'declare') {
    return (inner * DECLARE_WIDTH_PCT) / DECLARE_ASPECT;
  }
  if (item.type === 'category') {
    const spec = OBJECT_SPECS[getObjectType(item.category)];
    return (inner * spec.widthPct) / spec.aspect;
  }
  return 0;
}

function shelfTitle(category: { id: string; name: string }): string {
  const fixed = SHELF_TITLES[category.id];
  if (fixed) return fixed;
  const name = category.name.trim();
  return name.length > TITLE_LIMIT ? `${name.slice(0, TITLE_LIMIT - 1).trimEnd()}…` : name;
}

// Carousel item height relative to screen
const ITEM_HEIGHT_RATIO = 0.68;

export default function DocumentsScreen() {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [dimensions, setDimensions] = useState({ width: 375, height: 750 });

  const [categories, setCategories] = useState<PDFCategory[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PDFDocument | null>(null);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [peekDocument, setPeekDocument] = useState<PDFDocument | null>(null);
  const [showPeek, setShowPeek] = useState(false);
  const [passIndex, setPassIndex] = useState(0);
  const [showBarcodeSheet, setShowBarcodeSheet] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [declareItems, setDeclareItems] = useState<string[]>([]);
  const [containerHeight, setContainerHeight] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isPagingEnabled, setIsPagingEnabled] = useState(true);
  /**
   * Which object is open, if any — the titles step aside for it.
   *
   * Held by id rather than as a flag so a close only clears the state if it
   * came from the object that set it. Two cards report in as the carousel
   * moves, and a bare boolean would let a neighbour's close wipe out the open
   * one's claim.
   */
  const [openObjectId, setOpenObjectId] = useState<string | null>(null);

  const handleObjectOpenChange = useCallback((id: string, isOpen: boolean) => {
    setOpenObjectId((current) => (isOpen ? id : current === id ? null : current));
  }, []);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [islandActive, setIslandActive] = useState(false);
  const [showStamps, setShowStamps] = useState(false);
  const [pagesDocument, setPagesDocument] = useState<PDFDocument | null>(null);

  const [pendingDeepLink, setPendingDeepLink] = useState<{ cat?: string; doc: string } | null>(null);

  // The Dynamic Island browser is iOS 16.2+ only; elsewhere the control is hidden.
  const islandSupported = IslandService.isSupported();

  const SCREEN_WIDTH = dimensions.width;
  const SCREEN_HEIGHT = dimensions.height;
  const itemHeight = SCREEN_HEIGHT * ITEM_HEIGHT_RATIO;

  // header overlays and text follow the sky so night stays readable
  const sky = getSkyPalette();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    hasSeenOnboarding().then((seen) => setShowOnboarding(!seen));
  }, []);

  // The system can dismiss the activity while we're backgrounded, so re-read the
  // real state on every foreground rather than trusting the toggle.
  useEffect(() => {
    if (!islandSupported) return;

    setIslandActive(IslandService.isRunning());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setIslandActive(IslandService.isRunning());
    });
    return () => subscription.remove();
  }, [islandSupported]);

  // Mirror the documents into the App Group and nudge a running island so adds
  // and deletes show up there too.
  useEffect(() => {
    IslandService.syncCatalog(categories);
  }, [categories]);

  // travelet:///?cat=…&doc=… — tapping a document in the island lands here.
  // Read straight off Linking rather than expo-router search params: the link
  // targets the route we're already on, so the router doesn't re-navigate and
  // never surfaces the query.
  useEffect(() => {
    const receive = (incoming: string | null) => {
      if (!incoming) return;
      const { queryParams } = Linking.parse(incoming);
      const doc = typeof queryParams?.doc === 'string' ? queryParams.doc : undefined;
      if (!doc) return;
      const cat = typeof queryParams?.cat === 'string' ? queryParams.cat : undefined;
      setPendingDeepLink({ cat, doc });
    };

    Linking.getInitialURL().then(receive);
    const subscription = Linking.addEventListener('url', ({ url }) => receive(url));
    return () => subscription.remove();
  }, []);

  // Held until the documents are loaded, so a cold launch from the island still
  // lands on the right document.
  useEffect(() => {
    if (!pendingDeepLink || categories.length === 0) return;

    const category = categories.find((c) => c.id === pendingDeepLink.cat);
    const pool = category ? category.documents : categories.flatMap((c) => c.documents);
    const document = pool.find((d) => d.id === pendingDeepLink.doc);

    if (document) {
      setPeekDocument(document);
      setShowPeek(true);
    }

    setPendingDeepLink(null);
  }, [pendingDeepLink, categories]);

  useEffect(() => {
    setDimensions({ width: winWidth, height: winHeight });
    loadCategories();
    loadDeclareItems();

    // Check for Windows on web to disable snapping (paging)
    if (Platform.OS === 'web') {
      const isWindows = /Win/.test(navigator.platform) || /Windows/.test(navigator.userAgent);
      if (isWindows) {
        setIsPagingEnabled(false);
      }
    }
  }, [winWidth, winHeight]);

  const loadDeclareItems = async () => {
    try {
      const items = await PDFService.getDeclareItems();
      setDeclareItems(items);
    } catch (error) {
      console.error('Error loading declare items:', error);
    }
  };

  const handleChangeDeclareItems = (items: string[]) => {
    setDeclareItems(items);
    PDFService.saveDeclareItems(items).catch((error) =>
      console.error('Error saving declare items:', error)
    );
  };

  /**
   * `silent` refreshes leave the carousel mounted.
   *
   * Showing the full-screen loader tears the carousel down and it comes back at
   * `defaultIndex`, which threw you to the first sleeve every time a document
   * was added, renamed or deleted. Only the very first load blocks the screen.
   */
  const loadCategories = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const loadedCategories = await PDFService.getCategories();
      setCategories(loadedCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
      const message = err instanceof Error ? err.message : 'Failed to load categories';
      setError(message);
      if (Platform.OS === 'web') {
        console.warn('Alert: ' + message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleDocumentAdded = async (_document: PDFDocument) => {
    try {
      await loadCategories({ silent: true });
    } catch (error) {
      console.error('Error reloading categories:', error);
    }
  };

  const handleDocumentDeleted = async (document: PDFDocument) => {
    try {
      const category = categories.find((c) => c.documents.some((d) => d.id === document.id));
      if (category) {
        await PDFService.deleteDocument(category.id, document.id);
        await loadCategories({ silent: true });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  /**
   * Every scannable document across every category, in the order they appear on
   * screen. The pass view is a deck you swipe through, so it needs all of them
   * even when you only tapped one.
   */
  const passItems: PassItem[] = categories.flatMap((category) => {
    const spec = OBJECT_SPECS[getObjectType(category)];
    return category.documents
      .filter((document) => !!document.barcode)
      .map((document) => ({
        document,
        barcode: document.barcode!,
        accent: spec.interior.accent,
        gradient: spec.interior.gradient,
        paper: spec.interior.bg,
        objectType: getObjectType(category),
      }));
  });

  // Read every pass once the first screen has settled, rather than when one is
  // opened. A parse is slow enough to be visible, so the only way the first tap
  // feels instant is for the work to already be done by the time it happens.
  // These run at the back of the queue and yield between files, so a tap that
  // lands mid-warm-up still goes first.
  useEffect(() => {
    if (categories.length === 0) return;

    const task = InteractionManager.runAfterInteractions(() => {
      warmPdfInsights(
        categories.flatMap((category) =>
          category.documents
            .filter((document) => !!document.barcode)
            .map((document) => document.filePath)
        )
      );

      /**
       * Page images for the documents that have no code to show.
       *
       * Those added before previews reached them carry `barcode: null`, which
       * is the one value that stops the per-document backfill from ever looking
       * at them again — so the sweep happens here, off the first tap, and the
       * shelf is reloaded only if it actually gained anything. That reload
       * brings us back through this effect, where the second pass finds nothing
       * left to render and stops.
       */
      PDFService.backfillPreviews()
        .then((rendered) => {
          if (rendered > 0) loadCategories({ silent: true });
        })
        .catch((error) => {
          console.warn('Could not render page images', error);
        });

      /**
       * Reminders follow the shelf.
       *
       * Run here rather than on a timer or at launch: the parse this depends on
       * is warming in the same pass, and every change to the shelf — a pass
       * added, renamed or thrown away — brings us back through this effect,
       * which is exactly when the schedule needs rebuilding.
       */
      syncFlightReminders(categories).catch((error) => {
        console.warn('Could not schedule flight reminders', error);
      });
    });

    return () => task.cancel();
  }, [categories]);

  // A document you'd hold up to a scanner goes straight to its code; anything
  // else "x-rays" into the frosted peek panel first.
  const handleViewDocument = (document: PDFDocument) => {
    // A code is what you came for, so it wins over anything else the document
    // has — checked first rather than relying on a pass never having a page
    // image alongside it.
    const index = passItems.findIndex((item) => item.document.id === document.id);
    if (index >= 0) {
      setPassIndex(index);
      setShowBarcodeSheet(true);
      return;
    }

    // A document with a rendered page is meant to be read, so open it directly
    // rather than routing through a card that only shows a thumbnail of it.
    if (document.preview) {
      setPagesDocument(document);
      return;
    }

    setPeekDocument(document);
    setShowPeek(true);
  };

  // Imported files arrive with machine-generated names like
  // "lvtckt-28332756-59C542D280E877B0", so renaming needs to be one tap away
  // from wherever you're looking at the document.
  const handleRenameDocument = (document: PDFDocument) => {
    Alert.prompt(
      'Rename document',
      'Give it a name you’ll recognise at the gate.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (value?: string) => {
            if (!value?.trim()) return;
            try {
              await PDFService.renameDocument(document.id, value);
              await loadCategories({ silent: true });
            } catch {
              Alert.alert('Error', 'Could not rename that document.');
            }
          },
        },
      ],
      'plain-text',
      document.name
    );
  };

  // From the pass, "Full document" backs out into the usual peek.
  const handleShowDetails = (document: PDFDocument) => {
    setShowBarcodeSheet(false);
    setPeekDocument(document);
    setShowPeek(true);
  };

  const handleOpenOriginal = (document: PDFDocument) => {
    setShowPeek(false);
    setSelectedDocument(document);
    setShowPDFViewer(true);
  };

  const accentForDocument = (document: PDFDocument | null): string => {
    if (!document) return '#2563eb';
    const category = categories.find((c) => c.documents.some((d) => d.id === document.id));
    if (!category) return '#2563eb';
    return OBJECT_SPECS[getObjectType(category)].interior.accent;
  };

  /** Paper colour of the object a document lives in. */
  const paperForDocument = (document: PDFDocument | null): string => {
    if (!document) return '#f6efdf';
    const category = categories.find((c) => c.documents.some((d) => d.id === document.id));
    if (!category) return '#f6efdf';
    return OBJECT_SPECS[getObjectType(category)].interior.bg;
  };

  /** Drives which set of pass fields a document is laid out with. */
  const objectTypeForDocument = (document: PDFDocument | null): ObjectType => {
    if (!document) return 'folder';
    const category = categories.find((c) => c.documents.some((d) => d.id === document.id));
    return category ? getObjectType(category) : 'folder';
  };

  const handleToggleIsland = async () => {
    try {
      if (islandActive) {
        await IslandService.stop();
        setIslandActive(false);
        return;
      }

      if (!IslandService.areActivitiesEnabled()) {
        Alert.alert(
          'Live Activities are off',
          'Turn on Live Activities for Travelet in Settings to browse your documents from the Dynamic Island.'
        );
        return;
      }

      // Push the latest documents before requesting, so the island has something
      // to render on its very first frame.
      IslandService.syncCatalog(categories);
      await IslandService.start(0);
      setIslandActive(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open the Dynamic Island';
      Alert.alert('Dynamic Island', message);
    }
  };

  const handleClosePDFViewer = () => {
    setShowPDFViewer(false);
    setSelectedDocument(null);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={[styles.loadingText, { color: '#ef4444', marginTop: 16 }]}>
            Error: {error}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadCategories()}>
            <Text style={{ color: 'white', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const carouselData: ShelfItem[] = [
    { type: 'declare', id: 'declare-section' },
    ...categories.map((c) => ({ type: 'category' as const, category: c, id: c.id })),
    { type: 'add', id: 'add-category-button' },
  ];

  const renderItem = ({ item, index }: { item: ShelfItem; index: number }) => {
    // the arch hangs from a box whose foot is just above the cover's top edge
    const titleBox = {
      height: Math.max(
        0,
        ITEM_PAD_Y + (itemHeight - ITEM_PAD_Y * 2 - coverHeight(item, SCREEN_WIDTH)) / 2 - TITLE_GAP
      ),
    };
    // an arch belongs to a shut cover; once something is open it is in the way
    const showing = index === carouselIndex && openObjectId === null;

    if (item.type === 'declare') {
      return (
        <View style={styles.carouselItemContainer}>
          <View style={[styles.shelfTitle, titleBox]} pointerEvents="none">
            <ArchTitle text="Declarations" active={showing} />
          </View>
          <DeclareObject
            items={declareItems}
            onChangeItems={handleChangeDeclareItems}
            onOpenChange={(isOpen) => handleObjectOpenChange(item.id, isOpen)}
          />
        </View>
      );
    }

    if (item.type === 'add') {
      return (
        <View style={styles.carouselItemContainer}>
          <View style={styles.addCategoryCenter}>
            <TouchableOpacity
              style={styles.addCategoryCard}
              onPress={() => setShowAddCategoryModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.addCategoryTab} />
              <View style={styles.addCategoryBody}>
                <View style={styles.addCategoryIconContainer}>
                  <Ionicons name="add" size={36} color="#8a6d3b" />
                </View>
                <Text style={styles.addCategoryTitle}>New Folder</Text>
                <Text style={styles.addCategorySubtitle}>
                  Create a new home for your documents
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.carouselItemContainer}>
        <View style={[styles.shelfTitle, titleBox]} pointerEvents="none">
          <ArchTitle text={shelfTitle(item.category)} active={showing} />
        </View>
        <CategoryObject
          category={item.category}
          onDocumentAdded={handleDocumentAdded}
          onDocumentDeleted={handleDocumentDeleted}
          onViewDocument={handleViewDocument}
          onOpenChange={(isOpen) => handleObjectOpenChange(item.id, isOpen)}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sky with drifting clouds behind a sheet of glass */}
      <CloudBackground />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <View
            style={styles.carouselWrapper}
            onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
          >
            {containerHeight > 0 && (
              <Carousel
                vertical
                style={{
                  width: SCREEN_WIDTH,
                  height: containerHeight,
                }}
                width={SCREEN_WIDTH}
                height={itemHeight}
                data={carouselData}
                loop={false}
                renderItem={renderItem}
                mode="parallax"
                modeConfig={{
                  // Active card at 100% scale so text rasterizes crisply
                  parallaxScrollingScale: 1,
                  parallaxScrollingOffset: 50,
                  parallaxAdjacentItemScale: 0.9,
                }}
                defaultIndex={carouselIndex}
                onSnapToItem={setCarouselIndex}
                pagingEnabled={isPagingEnabled}
                snapEnabled={isPagingEnabled}
              />
            )}
          </View>

        </View>

        {/* First-launch tour */}
        <Onboarding
          visible={showOnboarding}
          onDone={(profile) => {
            setShowOnboarding(false);
            markOnboardingSeen();
            saveOnboardingProfile(profile);
            // Offered straight after, and only to a shelf that has nothing on
            // it — someone who already keeps documents here does not need one
            // planted.
            if (categories.every((c) => c.documents.length === 0)) setShowSample(true);
          }}
        />

        <SampleDocumentPrompt
          visible={showSample}
          onSkip={() => setShowSample(false)}
          onAccept={async () => {
            const added = await addSampleDocument();
            setShowSample(false);
            if (!added) return;
            // Straight into it: the point of the sample is what the app makes
            // of a document, which is only visible once one is open.
            await loadCategories({ silent: true });
            handleViewDocument(added);
          }}
        />

        {/* Frosted-glass peek inside a document */}
        <DocumentPeek
          document={peekDocument}
          accent={accentForDocument(peekDocument)}
          paper={paperForDocument(peekDocument)}
          objectType={objectTypeForDocument(peekDocument)}
          gradient={OBJECT_SPECS[objectTypeForDocument(peekDocument)].interior.gradient}
          visible={showPeek}
          onClose={() => setShowPeek(false)}
          onOpenOriginal={handleOpenOriginal}
          onRename={handleRenameDocument}
          onDelete={(doc) => {
            setShowPeek(false);
            handleDocumentDeleted(doc);
          }}
        />

        {/* PDF Viewer */}
        {selectedDocument && (
          <PDFViewer
            visible={showPDFViewer}
            filePath={selectedDocument.filePath}
            documentName={selectedDocument.name}
            onClose={handleClosePDFViewer}
          />
        )}

        <AddCategoryModal
          visible={showAddCategoryModal}
          onClose={() => setShowAddCategoryModal(false)}
          onAdd={async (name, scheme) => {
            try {
              await PDFService.addCategory(
                name,
                scheme.color,
                scheme.borderColor,
                scheme.accentColor,
                scheme.textColor
              );
              await loadCategories({ silent: true });
              setShowAddCategoryModal(false);
            } catch (error) {
              Alert.alert('Error', 'Failed to add category');
            }
          }}
        />
      </SafeAreaView>

      {/* Overlays span the physical screen edges (notch to home bar) so the
          fades blend into the sky with no seams */}
      <LinearGradient
        colors={[
          `rgba(${sky.topRGB},1)`,
          `rgba(${sky.topRGB},1)`,
          `rgba(${sky.topRGB},0.85)`,
          `rgba(${sky.topRGB},0.45)`,
          `rgba(${sky.topRGB},0.1)`,
          `rgba(${sky.topRGB},0)`,
        ]}
        locations={[0, 0.5, 0.68, 0.8, 0.9, 1]}
        style={styles.topOverlay}
        pointerEvents="none"
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.traveletTitle, { color: sky.text }]}>travelet</Text>
            <Image
              source={require('../../assets/images/airplane-icon.png')}
              style={styles.airplaneIcon}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.explanation, { color: sky.subtext }]}>
            Your travel paperwork, as real as it gets.
          </Text>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={[
          `rgba(${sky.bottomRGB},0)`,
          `rgba(${sky.bottomRGB},0.25)`,
          `rgba(${sky.bottomRGB},0.6)`,
          `rgba(${sky.bottomRGB},0.85)`,
        ]}
        locations={[0, 0.35, 0.7, 1]}
        style={styles.bottomOverlay}
        pointerEvents="none"
      />

      <PageViewer
        document={pagesDocument}
        visible={!!pagesDocument}
        onClose={() => setPagesDocument(null)}
        onOpenOriginal={(doc) => {
          setPagesDocument(null);
          handleOpenOriginal(doc);
        }}
      />

      {/* Scannable code, straight from a tap on the document. An overlay in
          this tree rather than a Modal: presenting a modal spins up a whole
          view controller before the content is even laid out, and that wait is
          most of what the tap felt like. Last child of the root, outside the
          safe area, so it still covers the screen. */}
      <BarcodeSheet
        items={passItems}
        initialIndex={passIndex}
        visible={showBarcodeSheet}
        onClose={() => setShowBarcodeSheet(false)}
        onShowDetails={handleShowDetails}
        onRename={handleRenameDocument}
      />

      <StampBook visible={showStamps} onClose={() => setShowStamps(false)} />

      {/* Sits above the non-interactive top gradient, so it needs its own layer */}
      <TouchableOpacity
        style={[styles.stampsButton, { top: insets.top + 8, borderColor: sky.subtext }]}
        onPress={() => setShowStamps(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Places you have visited"
      >
        <Ionicons name="earth-outline" size={13} color={sky.subtext} />
        <Text style={[styles.islandToggleText, { color: sky.subtext }]}>Places</Text>
      </TouchableOpacity>

      {islandSupported && (
        <TouchableOpacity
          style={[
            styles.islandToggle,
            { top: insets.top + 8, borderColor: sky.subtext },
            islandActive && { backgroundColor: 'rgba(37,99,235,0.18)', borderColor: '#2563eb' },
          ]}
          onPress={handleToggleIsland}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            islandActive ? 'Close the Dynamic Island browser' : 'Browse documents in the Dynamic Island'
          }
        >
          <Ionicons
            name={islandActive ? 'ellipse' : 'ellipse-outline'}
            size={13}
            color={islandActive ? '#2563eb' : sky.subtext}
          />
          <Text
            style={[styles.islandToggleText, { color: islandActive ? '#2563eb' : sky.subtext }]}
          >
            Island
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0ff',
  },
  carouselWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 170,
  },
  carouselItemContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  /**
   * Floated over the item rather than stacked above it. In the flow it would
   * take its height out of the object below, and every cover on the shelf would
   * shrink to make room for its own label.
   */
  shelfTitle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    // the arch is pinned to the foot of this box, so it rides just above the
    // cover however tall the object under it happens to be
    justifyContent: 'flex-end',
  },
  addCategoryCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCategoryCard: {
    width: '74%',
    aspectRatio: 0.8,
  },
  addCategoryTab: {
    alignSelf: 'flex-start',
    width: '46%',
    height: 26,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(138,109,59,0.5)',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: -2,
  },
  addCategoryBody: {
    flex: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(138,109,59,0.5)',
    borderRadius: 10,
    borderTopLeftRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  addCategoryIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(232,198,143,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  addCategoryTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 19,
    fontWeight: '800',
    color: '#6b5530',
    marginBottom: 6,
  },
  addCategorySubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#8a6d3b',
    textAlign: 'center',
    opacity: 0.8,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
    zIndex: 10,
  },
  header: {
    marginBottom: 0,
  },
  stampsButton: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  islandToggle: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  islandToggleText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  traveletTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#020403',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'BeVietnamPro-Black',
    textTransform: 'none',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  airplaneIcon: {
    width: 28,
    height: 28,
    marginTop: -2,
  },
  explanation: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 0,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#6b7280',
  },
});
