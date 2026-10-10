import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function ErrorBanner({ message, onDismiss, onRetry }) {
  if (!message) return null;

  return (
    <View style={styles.container}>
      <View style={styles.leftBar} />
      <View style={styles.content}>
        <Text style={styles.title}>Error</Text>
        <Text style={styles.message}>{message}</Text>
        {onRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
      {onDismiss && (
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#451A1A',
    borderRadius: 12,
    marginVertical: 10,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    overflow: 'hidden',
  },
  leftBar: {
    width: 6,
    backgroundColor: '#EF4444',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  title: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  message: {
    color: '#FECACA',
    fontSize: 12,
    lineHeight: 17,
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissBtn: {
    padding: 10,
    justifyContent: 'center',
  },
  dismissText: {
    color: '#FCA5A5',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
