
import React, { useState } from 'react';
import { Session, Step } from '../types';
import SetupStep from './SetupStep';
import Round1 from './Round1';
import Round2 from './Round2';
import Round3 from './Round3';
import Summary from './Summary';
import CompletionStep from './CompletionStep';
import ProgressIndicator from './ProgressIndicator';
import { generateSessionSummary } from '../services/geminiService';

interface SessionWizardProps {
  session: Session;
  onUpdateSession: (updatedSession: Session) => void;
  onComplete: () => void;
}

const SessionWizard: React.FC<SessionWizardProps> = ({ session, onUpdateSession, onComplete }) => {
  const [currentStep, setCurrentStep] = useState<Step>('setup');
  
  // Skip setup if persona is already filled (resuming)
  React.useEffect(() => {
    if (session.persona.ageGroup && currentStep === 'setup') {
        // Fallback for old data structure if needed, or just check length
        const r1Completed = session.round1.selectedConfigIds?.length > 0;
        const r2Completed = session.round2.selectedConfigIds?.length > 0;

        if (!r1Completed) setCurrentStep('round1');
        else if (!r2Completed) setCurrentStep('round2');
        else if (!session.round3.selectedImageIndex && session.round3.selectedImageIndex !== 0) setCurrentStep('round3');
        else setCurrentStep('summary');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetupComplete = (persona: any) => {
    onUpdateSession({ ...session, persona });
    setCurrentStep('round1');
  };

  const handleRound1Complete = (data: any) => {
    onUpdateSession({ ...session, round1: data });
    setCurrentStep('round2');
  };

  const handleRound2Complete = (data: any) => {
    onUpdateSession({ ...session, round2: data });
    setCurrentStep('round3');
  };

  const handleRound3Complete = async (data: any) => {
    // Helper to recompress images to prevent localStorage quota errors
    const recompressImage = (base64Str: string | null): Promise<string | null> => {
        if (!base64Str || !base64Str.startsWith('data:image')) return Promise.resolve(base64Str);
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024; // Reduce size for storage
                const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    // Use JPEG for better compression
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); 
                } else {
                    resolve(base64Str); // Fallback to original if canvas fails
                }
            };
            img.onerror = () => resolve(base64Str); // Fallback on error
        });
    };
    
    // Compress all images from Round 3
    const compressedGeneratedImages = await Promise.all(
        (data.generatedImages || []).map((img: string) => recompressImage(img))
    );
    const compressedStyleImage = await recompressImage(data.styleImageBase64);

    const updatedData = { 
      ...data, 
      generatedImages: compressedGeneratedImages.filter(img => img !== null) as string[],
      styleImageBase64: compressedStyleImage
    };

    const updatedSession = { 
        ...session, 
        round3: updatedData,
        status: 'completed' as const,
        updatedAt: Date.now() 
    };
    onUpdateSession(updatedSession);
    setCurrentStep('completion'); // Go to thank you page

    // Generate summary in the background using the updated session data
    generateSessionSummary(updatedSession).then(summary => {
        onUpdateSession({ ...updatedSession, aiSummary: summary });
    }).catch(e => {
        console.error("Failed to generate summary in background", e);
        onUpdateSession({ ...updatedSession, aiSummary: "AI总结生成失败，请稍后重试。" });
    });
  };

  const canNavigateTo = (step: Step) => {
    // Only allow navigation if the previous requirements for that step are met
    // Setup is always allowed
    if (step === 'setup') return true;
    
    // Round 1 requires Persona
    if (step === 'round1') {
        return !!session.persona.ageGroup;
    }
    
    // Round 2 requires Round 1 done
    if (step === 'round2') {
        return session.round1.selectedConfigIds?.length > 0;
    }

    // Round 3 requires Round 2 done
    if (step === 'round3') {
        return session.round2.selectedConfigIds?.length > 0;
    }

    return false;
  };

  const showProgress = ['setup', 'round1', 'round2', 'round3'].includes(currentStep);

  return (
    <div className="w-full">
      {showProgress && (
        <ProgressIndicator 
            currentStep={currentStep} 
            onNavigate={setCurrentStep}
            canNavigateTo={canNavigateTo}
        />
      )}

      {currentStep === 'setup' && <SetupStep initialPersona={session.persona} onNext={handleSetupComplete} />}
      {currentStep === 'round1' && <Round1 session={session} onNext={handleRound1Complete} />}
      {currentStep === 'round2' && <Round2 session={session} onNext={handleRound2Complete} />}
      {currentStep === 'round3' && <Round3 session={session} onNext={handleRound3Complete} />}
      {currentStep === 'completion' && <CompletionStep onFinish={onComplete} />}
      {currentStep === 'summary' && <Summary session={session} onDone={onComplete} />}
    </div>
  );
};

export default SessionWizard;
