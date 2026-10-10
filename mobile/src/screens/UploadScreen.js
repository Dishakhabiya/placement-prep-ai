import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useProfileStore } from '../store/profileStore';
import ErrorBanner from '../components/ErrorBanner';

const INTERVIEW_MODES = [
  { id: 'mixed', label: 'Mixed', desc: 'Holistic mix of technical, resume projects & behavioral' },
  { id: 'technical', label: 'Technical', desc: 'Core CS, DSA, algorithms & system architecture' },
  { id: 'resume-based', label: 'Resume-Based', desc: 'Candidate projects, tech stack & past experience' },
  { id: 'jd-based', label: 'JD-Based', desc: 'Target role requirements, scenarios & tech stack' },
  { id: 'hr', label: 'HR & Behavioral', desc: 'Leadership, communication & cultural alignment' },
];

const SAMPLE_JDS = {
  backend: `Job Title: Backend Software Engineer
Requirements:
- Must have hands-on experience in Python and FastAPI
- Strong proficiency in SQL and PostgreSQL database design
- Good understanding of Data Structures and Algorithms (DSA)
- Experience with Docker containerization is a plus
Responsibilities:
- Build resilient microservices and RESTful APIs
- Maintain database schemas and query optimization
- Collaborate with frontend engineers on system design`,

  frontend: `Job Title: Frontend React Developer
Requirements:
- Strong knowledge of JavaScript, TypeScript, and React / React Native
- Proficiency in HTML, CSS, and modern state management (Redux/Zustand)
- Good to have experience with REST APIs and Git
Responsibilities:
- Build responsive, interactive user interfaces
- Optimize mobile/web app performance and accessibility
- Work closely with UI/UX designers and backend team`,

  ml: `Job Title: Machine Learning & NLP Engineer
Requirements:
- Must have strong background in Python, PyTorch, and scikit-learn
- Hands-on experience with Natural Language Processing (NLP), spaCy, or Transformers
- Experience with FastAPI and Docker for model deployment is preferred
Responsibilities:
- Design and fine-tune transformer models for text classification
- Develop real-time inference pipelines and REST APIs
- Evaluate precision, recall, and model latency metrics`,
};

export default function UploadScreen({ navigation }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [jdText, setJdText] = useState('');
  const [selectedMode, setSelectedMode] = useState('mixed');
  const [validationError, setValidationError] = useState(null);

  const { submitResumeAndJD, error, clearError } = useProfileStore();

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'docx'].includes(ext)) {
          setValidationError('Only PDF (.pdf) and Word (.docx) files are supported.');
          return;
        }
        setSelectedFile(file);
        setValidationError(null);
      }
    } catch (e) {
      setValidationError('Failed to select document: ' + e.message);
    }
  };

  const handleApplySampleJD = (key) => {
    setJdText(SAMPLE_JDS[key]);
    setValidationError(null);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setValidationError('Please select a resume file (PDF or DOCX).');
      return;
    }
    if (!jdText.trim()) {
      setValidationError('Please paste or select a Job Description.');
      return;
    }

    setValidationError(null);
    clearError();

    navigation.navigate('Processing');

    try {
      await submitResumeAndJD({
        file: selectedFile,
        jdText: jdText.trim(),
        mode: selectedMode,
      });
      navigation.replace('ReviewProfile');
    } catch (err) {
      // Error handled in Processing screen state
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Step 1: Resume Upload */}
        <View style={styles.card}>
          <Text style={styles.stepTitle}>1. Upload Candidate Resume</Text>
          <Text style={styles.stepSubtitle}>Supported formats: PDF (.pdf) or Word (.docx)</Text>

          {selectedFile ? (
            <View style={styles.fileSelectedBox}>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>
                  📄 {selectedFile.name}
                </Text>
                <Text style={styles.fileSize}>
                  {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Ready'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeFileBtn}
                onPress={() => setSelectedFile(null)}
              >
                <Text style={styles.changeFileText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadArea} onPress={handlePickDocument}>
              <Text style={styles.uploadIcon}>📁</Text>
              <Text style={styles.uploadMainText}>Tap to select resume file</Text>
              <Text style={styles.uploadSubText}>Max size: 10MB</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step 2: Target Job Description */}
        <View style={styles.card}>
          <View style={styles.jdHeader}>
            <Text style={styles.stepTitle}>2. Target Job Description</Text>
            <Text style={styles.charCount}>{jdText.length} chars</Text>
          </View>
          <Text style={styles.stepSubtitle}>Paste the target role's job description or select a preset:</Text>

          {/* Sample Presets */}
          <View style={styles.presetRow}>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleApplySampleJD('backend')}
            >
              <Text style={styles.presetText}>+ Backend Eng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleApplySampleJD('frontend')}
            >
              <Text style={styles.presetText}>+ Frontend React</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleApplySampleJD('ml')}
            >
              <Text style={styles.presetText}>+ ML & NLP</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.jdInput}
            multiline
            numberOfLines={6}
            placeholder="Paste Job Description here (Requirements, Responsibilities, Skills)..."
            placeholderTextColor="#64748B"
            value={jdText}
            onChangeText={setJdText}
            textAlignVertical="top"
          />
        </View>

        {/* Step 3: Interview Mode Selection */}
        <View style={styles.card}>
          <Text style={styles.stepTitle}>3. Select Interview Mode</Text>
          <Text style={styles.stepSubtitle}>Tunes the interview topic ranking logic</Text>

          <View style={styles.modesList}>
            {INTERVIEW_MODES.map((mode) => {
              const isSelected = selectedMode === mode.id;
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.modeItem, isSelected && styles.modeItemSelected]}
                  onPress={() => setSelectedMode(mode.id)}
                >
                  <View style={styles.modeRadio}>
                    {isSelected && <View style={styles.modeRadioInner} />}
                  </View>
                  <View style={styles.modeContent}>
                    <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>
                      {mode.label}
                    </Text>
                    <Text style={styles.modeDesc}>{mode.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Validation or Error Message */}
        {validationError && (
          <ErrorBanner message={validationError} onDismiss={() => setValidationError(null)} />
        )}
        {error && <ErrorBanner message={error} onDismiss={clearError} />}

        {/* Submit CTA */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>Analyze Resume & Match JD →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 12,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  uploadSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  fileSelectedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  fileInfo: {
    flex: 1,
    marginRight: 10,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
  },
  fileSize: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  changeFileBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changeFileText: {
    fontSize: 12,
    color: '#F1F5F9',
    fontWeight: '600',
  },
  jdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 11,
    color: '#64748B',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  presetChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 6,
  },
  presetText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  jdInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    padding: 12,
    fontSize: 13,
    minHeight: 120,
    lineHeight: 18,
  },
  modesList: {
    marginTop: 4,
  },
  modeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    marginBottom: 8,
  },
  modeItemSelected: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  modeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modeRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  modeContent: {
    flex: 1,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  modeLabelSelected: {
    color: '#38BDF8',
  },
  modeDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
