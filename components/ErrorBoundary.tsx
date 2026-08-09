import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The floor under the whole app.
 *
 * Without one, a throw anywhere in a render unmounts the tree and leaves a
 * white screen with no way back — the app has to be force-quit, and whatever
 * caused it is invisible. That is a poor thing to hand a stranger holding your
 * documents, and it is the state an App Store reviewer would file a rejection
 * from rather than try again.
 *
 * Deliberately plain. Everything else in the app is blur, gradients, gesture
 * handlers and native views, and this is the one screen that has to render when
 * one of those is what went wrong — so it is built from a View, a Text and an
 * icon, and nothing that could fail for the same reason twice.
 *
 * A class because there is still no hook for this: `componentDidCatch` and
 * `getDerivedStateFromError` have no function-component equivalent.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Goes to the device log, which is where it can be read from a TestFlight
    // build. Nothing is sent anywhere.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  /**
   * Mounts the tree again from scratch.
   *
   * Most crashes here would come from one document with something unexpected in
   * it, and the shelf is read from disk on mount — so a retry lands on the same
   * shelf minus whatever transient state caused it, which is usually enough to
   * get back in and delete the offending document.
   */
  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.screen}>
        <View style={styles.mark}>
          <Ionicons name="airplane-outline" size={26} color="#0f172a" />
        </View>

        <Text style={styles.title}>That didn&apos;t open</Text>
        <Text style={styles.body}>
          Something went wrong drawing this. Your documents are safe on the
          device — nothing has been lost.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={this.retry}
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>

        {/* The reason, for anyone who can act on it — a TestFlight tester
            reporting it, or us reading a screenshot of it. */}
        <Text style={styles.detail} numberOfLines={4}>
          {error.message || String(error)}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
    backgroundColor: '#eef2f7',
  },
  mark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  detail: {
    fontSize: 10,
    lineHeight: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
});
