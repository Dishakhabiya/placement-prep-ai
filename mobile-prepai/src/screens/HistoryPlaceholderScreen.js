import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import TopBar from '../components/TopBar';
import BackgroundBlobs from '../components/BackgroundBlobs';

export default function HistoryPlaceholderScreen({ navigation }) {
  const { colors, fonts } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <BackgroundBlobs />
      <TopBar navigation={navigation} />
      <View style={styles.content}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              { color: colors.ink, fontFamily: fonts.headingBlack },
            ]}
          >
            Practice History
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.muted, fontFamily: fonts.bodyRegular },
            ]}
          >
            Your past question responses, audio recordings, and evaluation scores
            will appear here.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.ink }]}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.btnText,
                { color: colors.bg, fontFamily: fonts.bodyBold },
              ]}
            >
              Back to Practise
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    maxWidth: 520,
    width: '100%',
    padding: 36,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 999,
  },
  btnText: {
    fontSize: 15,
  },
});
