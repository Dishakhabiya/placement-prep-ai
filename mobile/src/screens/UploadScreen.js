import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useProfileStore } from '../store/profileStore';
import ErrorBanner from '../components/ErrorBanner';
import Caricatures from '../assets/caricatures';

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
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedJdFile, setSelectedJdFile] = useState(null);
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

  const handlePickJdDocument = async () => {
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
          setValidationError('Job Description file must be a PDF (.pdf) or Word (.docx).');
          return;
        }
        setSelectedJdFile(file);
        setValidationError(null);
      }
    } catch (e) {
      setValidationError('Failed to select JD document: ' + e.message);
    }
  };

  const handleApplySampleJD = (key) => {
    setSelectedJdFile(null);
    setJdText(SAMPLE_JDS[key]);
    setValidationError(null);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setValidationError('Please select a resume file (PDF or DOCX).');
      return;
    }
    if (!jdText.trim() && !selectedJdFile) {
      setValidationError('Please provide a Job Description: paste text or upload a PDF/DOCX.');
      return;
    }

    setValidationError(null);
    clearError();

    navigation.navigate('Processing');

    try {
      await submitResumeAndJD({
        file: selectedFile,
        jdText: jdText.trim(),
        jdFile: selectedJdFile,
        mode: selectedMode,
      });
      navigation.replace('ReviewProfile');
    } catch (err) {
      // Error handled in Processing screen state
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Validation or API Errors */}
        {validationError && (
          <View style={styles.errorAlert}>
            <Text style={styles.errorAlertText}>⚠️ {validationError}</Text>
          </View>
        )}
        {error && <ErrorBanner message={error} onDismiss={clearError} />}

        {/* ================= STEP 1: RESUME UPLOAD ================= */}
        <View style={styles.stepCard}>
          <View style={styles.stepCardHeader}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepHeaderTextWrap}>
              <Text style={styles.stepTitle}>Upload Candidate Resume</Text>
              <Text style={styles.stepSubtitle}>Supported formats: PDF (.pdf) or Word (.docx)</Text>
            </View>
          </View>

          <View style={[styles.stepBodyRow, !isWide && styles.stepBodyCol]}>
            {/* Dashed Upload Box */}
            <View style={styles.uploadAreaWrapper}>
              {selectedFile ? (
                <View style={styles.fileSelectedBox}>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileSelectedIcon}>📄</Text>
                    <View>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <Text style={styles.fileSize}>
                        {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Ready for extraction'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.changeFileBtn}
                    onPress={() => setSelectedFile(null)}
                  >
                    <Text style={styles.changeFileText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.dashedBox} onPress={handlePickDocument}>
                  <View style={styles.dashedFolderIconWrap}>
                    <Text style={styles.dashedFolderIcon}>📂</Text>
                  </View>
                  <Text style={styles.uploadMainPrompt}>Tap to select resume file</Text>
                  <Text style={styles.uploadSubPrompt}>Max size: 10MB</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Right Caricature */}
            <View style={styles.caricatureCol}>
              <Image
                source={Caricatures.step1Resume || Caricatures.puzzleSkills}
                style={styles.caricatureImg}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* ================= STEP 2: JOB DESCRIPTION ================= */}
        <View style={styles.stepCard}>
          <View style={styles.stepCardHeader}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepHeaderTextWrap}>
              <Text style={styles.stepTitle}>Target Job Description</Text>
              <Text style={styles.stepSubtitle}>
                Paste the target role's job description or select a preset:
              </Text>
            </View>
            <Text style={styles.charCounterBadge}>
              {selectedJdFile ? 'Doc Attached' : `${jdText.length} chars`}
            </Text>
          </View>

          {/* Preset Buttons */}
          <View style={styles.presetsRow}>
            <TouchableOpacity
              style={styles.presetPill}
              onPress={() => handleApplySampleJD('backend')}
            >
              <Text style={styles.presetPillText}>+ Backend Eng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetPill}
              onPress={() => handleApplySampleJD('frontend')}
            >
              <Text style={styles.presetPillText}>+ Frontend React</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetPill}
              onPress={() => handleApplySampleJD('ml')}
            >
              <Text style={styles.presetPillText}>+ ML & NLP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetPill, styles.jdDocPill]}
              onPress={handlePickJdDocument}
            >
              <Text style={styles.jdDocPillText}>📎 {selectedJdFile ? selectedJdFile.name : 'Upload JD File'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.stepBodyRow, !isWide && styles.stepBodyCol]}>
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={styles.jdTextInput}
                placeholder="Paste Job Description here (Requirements, Responsibilities, Skills)..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={6}
                value={jdText}
                onChangeText={(text) => {
                  setJdText(text);
                  setSelectedJdFile(null);
                }}
                textAlignVertical="top"
              />
            </View>

            {/* Right Caricature */}
            <View style={styles.caricatureCol}>
              <Image
                source={Caricatures.step2JD || Caricatures.laptopHeadset}
                style={styles.caricatureImg}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* ================= STEP 3: INTERVIEW MODE ================= */}
        <View style={styles.stepCard}>
          <View style={styles.stepCardHeader}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepHeaderTextWrap}>
              <Text style={styles.stepTitle}>Select Interview Mode</Text>
              <Text style={styles.stepSubtitle}>Tunes the interview topic ranking logic</Text>
            </View>
          </View>

          <View style={[styles.stepBodyRow, !isWide && styles.stepBodyCol]}>
            {/* Radio Options */}
            <View style={styles.modesWrapper}>
              {INTERVIEW_MODES.map((mode) => {
                const isSelected = selectedMode === mode.id;
                return (
                  <TouchableOpacity
                    key={mode.id}
                    style={[styles.modeRow, isSelected && styles.modeRowSelected]}
                    onPress={() => setSelectedMode(mode.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.modeTextWrap}>
                      <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>
                        {mode.label}
                      </Text>
                      <Text style={styles.modeDesc}>{mode.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Right Caricature */}
            <View style={styles.caricatureCol}>
              <Image
                source={Caricatures.step3Mode || Caricatures.checklistSearch}
                style={styles.caricatureImgMode}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* Bottom Primary Submit Button */}
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
    backgroundColor: '#F8F9FA',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 1040,
    width: '100%',
    alignSelf: 'center',
  },
  errorAlert: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorAlertText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },

  // Step Card
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#4F46E5',
    fontWeight: '800',
    fontSize: 14,
  },
  stepHeaderTextWrap: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  charCounterBadge: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  stepBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBodyCol: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },

  // Step 1 Upload
  uploadAreaWrapper: {
    flex: 1,
    paddingRight: 16,
  },
  dashedBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C7D2FE',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedFolderIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dashedFolderIcon: {
    fontSize: 24,
  },
  uploadMainPrompt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: 4,
  },
  uploadSubPrompt: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  fileSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileSelectedIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  fileSize: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  changeFileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  changeFileText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },

  // Step 2 Presets & Text Area
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  jdDocPill: {
    backgroundColor: '#FEF9C3',
  },
  jdDocPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854D0E',
  },
  textAreaWrapper: {
    flex: 1,
    paddingRight: 16,
  },
  jdTextInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 13,
    color: '#111827',
    minHeight: 110,
    lineHeight: 18,
  },

  // Step 3 Modes
  modesWrapper: {
    flex: 1,
    paddingRight: 16,
    gap: 8,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modeRowSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: '#4F46E5',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4F46E5',
  },
  modeTextWrap: {
    flex: 1,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  modeLabelSelected: {
    color: '#4F46E5',
  },
  modeDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },

  // Caricatures Col
  caricatureCol: {
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caricatureImg: {
    width: 130,
    height: 95,
  },
  caricatureImgMode: {
    width: 130,
    height: 115,
  },

  // Submit Button
  submitBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
