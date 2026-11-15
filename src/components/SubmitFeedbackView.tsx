import { useState } from 'react';
import type { User } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  MAX_SESSION_NAME_LENGTH,
  MAX_TEXTAREA_LENGTH,
  OperationType,
} from '../firebase';
import type { FeedbackRating } from '../types/feedback';

interface SubmitFeedbackViewProps {
  activeSessionFromUrl: string | null;
  user: User | null;
  onRequireSignIn: () => Promise<User | null>;
  onShowToast: (message: string) => void;
}

export function SubmitFeedbackView({
  activeSessionFromUrl,
  user,
  onRequireSignIn,
  onShowToast,
}: SubmitFeedbackViewProps) {
  const [sessionName, setSessionName] = useState<string>(
    activeSessionFromUrl || 'General Session'
  );
  const [learningPoints, setLearningPoints] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      onShowToast('Share link copied to clipboard!');
    } catch {
      onShowToast('Unable to copy link automatically.');
    }
    document.body.removeChild(textArea);
  };

  const handleShareLink = () => {
    const currentSession = sessionName.trim() || 'General Session';
    const shareUrl =
      window.location.origin +
      window.location.pathname +
      '?session=' +
      encodeURIComponent(currentSession);

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          onShowToast('Share link copied to clipboard!');
        })
        .catch(() => {
          fallbackCopy(shareUrl);
        });
    } else {
      fallbackCopy(shareUrl);
    }
  };

  const handleFeedbackSubmit = async (type: FeedbackRating) => {
    if (isSubmitting) return;

    const rawSession = activeSessionFromUrl || sessionName.trim() || 'General Session';
    const sanitizedSessionName = rawSession.slice(0, MAX_SESSION_NAME_LENGTH);
    const sanitizedLearning = learningPoints.trim().slice(0, MAX_TEXTAREA_LENGTH);
    const sanitizedSuggestions = suggestions.trim().slice(0, MAX_TEXTAREA_LENGTH);

    setIsSubmitting(true);

    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await onRequireSignIn();
        if (!activeUser) {
          onShowToast('Please sign in with Google to submit feedback.');
          setIsSubmitting(false);
          return;
        }
      }

      const path = 'feedbacks';
      try {
        await addDoc(collection(db, path), {
          type,
          sessionName: sanitizedSessionName,
          learningPoints: sanitizedLearning,
          suggestions: sanitizedSuggestions,
          timestamp: serverTimestamp(),
          userId: activeUser.uid,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Quota exceeded')) {
          onShowToast('Daily database quota exceeded. Please try again tomorrow.');
          return;
        }
        handleFirestoreError(error, OperationType.CREATE, path);
      }

      setLearningPoints('');
      setSuggestions('');
      onShowToast(`Feedback saved for "${sanitizedSessionName}"! Thank you.`);
    } catch (err) {
      console.error('Submission error:', err);
      onShowToast('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center animate-fade-in gap-8 sm:gap-10">
      {/* Session Banner & Share Section (Hidden when ?session= is in URL) */}
      {!activeSessionFromUrl && (
        <div className="w-full max-w-xl bg-white p-5 sm:p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="session-name-input"
              className="text-xs font-extrabold text-slate-600 tracking-wide flex items-center gap-1.5"
            >
              <svg
                className="w-4 h-4 text-blue-600 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span>Session Name / සැසියේ නම</span>
            </label>
            <span className="text-xs text-blue-600 font-semibold">
              Active Session
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              id="session-name-input"
              value={sessionName}
              maxLength={MAX_SESSION_NAME_LENGTH}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Enter session name / සැසියේ නම ඇතුලත් කරන්න"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
            />
            <button
              type="button"
              onClick={handleShareLink}
              title="Copy shareable link for this session"
              className="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-900 active:bg-black text-white px-4 py-1.5 rounded-xl text-sm font-semibold transition-all shadow-sm shrink-0 leading-tight cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                <span>Share Link</span>
              </div>
              <span className="text-[10px] font-medium text-slate-300 mt-0.5">
                සබැඳිය බෙදාගන්න
              </span>
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Tip: Share this session link with attendees so their feedback is grouped automatically.
          </p>
        </div>
      )}

      {/* Header Title */}
      <div className="text-center flex flex-col items-center gap-2 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-black text-[#1e3a5f] tracking-tight leading-tight text-balance">
          Feedback Request <br />
          <span className="text-3xl sm:text-4xl text-[#2a4d7a]">
            ප්‍රතිපෝෂණ ඉල්ලීම
          </span>
          <span className="inline-block animate-bounce ml-2 text-3xl sm:text-5xl">
            💬
          </span>
        </h1>
        <p className="text-base sm:text-xl text-[#4a6b8c] font-medium mt-2">
          How was your experience in this session? <br />
          <span className="text-sm sm:text-lg">
            මෙම සැසියේ ඔබගේ අත්දැකීම කෙසේද?
          </span>
        </p>
      </div>

      {/* Additional Feedback Fields */}
      <div className="w-full max-w-2xl flex flex-col gap-5 mt-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="input-learning" className="text-sm font-bold text-slate-700">
            Session Learning Points{' '}
            <span className="text-slate-600 font-medium">
              / සැසියේදී ඉගෙන ගත් කරුණු
            </span>
          </label>
          <textarea
            id="input-learning"
            rows={2}
            value={learningPoints}
            maxLength={MAX_TEXTAREA_LENGTH}
            onChange={(e) => setLearningPoints(e.target.value)}
            placeholder="What were your main takeaways? / ඔබගේ ප්‍රධාන ඉගෙනුම් කරුණු මොනවාද?"
            className="px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="input-suggestions" className="text-sm font-bold text-slate-700">
            Suggestions for Improvement{' '}
            <span className="text-slate-600 font-medium">
              / වැඩිදියුණු කිරීම සඳහා යෝජනා
            </span>
          </label>
          <textarea
            id="input-suggestions"
            rows={2}
            value={suggestions}
            maxLength={MAX_TEXTAREA_LENGTH}
            onChange={(e) => setSuggestions(e.target.value)}
            placeholder="How can we make this session better? / මෙම සැසිය වඩාත් හොඳ කරන්නේ කෙසේද?"
            className="px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm transition-all shadow-sm"
          />
        </div>
      </div>

      {/* 3D Interactive Feedback Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 md:gap-14 w-full mt-2">
        {/* Great Button */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleFeedbackSubmit('good')}
            aria-label="Rate Great"
            className="feedback-btn bg-gradient-to-br from-[#98d41e] to-[#6da510] focus-visible:ring-4 focus-visible:ring-green-400"
          >
            <div className="btn-overlay" />
            <div className="btn-content">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                <path
                  d="M 35 25 L 38 33 L 47 33 L 40 39 L 43 48 L 35 42 L 27 48 L 30 39 L 23 33 L 32 33 Z"
                  fill="#224400"
                />
                <path
                  d="M 65 25 L 68 33 L 77 33 L 70 39 L 73 48 L 65 42 L 57 48 L 60 39 L 53 33 L 62 33 Z"
                  fill="#224400"
                />
                <path d="M 25 58 C 25 95, 75 95, 75 58 Z" fill="#224400" />
              </svg>
            </div>
          </button>
          <div className="text-center font-bold text-slate-700 text-lg">
            Great <br />
            <span className="text-sm text-slate-600 font-medium">හොඳයි</span>
          </div>
        </div>

        {/* Average Button */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleFeedbackSubmit('average')}
            aria-label="Rate Average"
            className="feedback-btn bg-gradient-to-br from-[#fde01b] to-[#d6b710] focus-visible:ring-4 focus-visible:ring-yellow-400"
          >
            <div className="btn-overlay" />
            <div className="btn-content">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                <ellipse cx="36" cy="36" rx="6.5" ry="10" fill="#18181b" />
                <ellipse cx="64" cy="36" rx="6.5" ry="10" fill="#18181b" />
                <path
                  d="M 21 57 Q 50 78 79 57"
                  stroke="#18181b"
                  strokeWidth={7.5}
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </button>
          <div className="text-center font-bold text-slate-700 text-lg">
            Average <br />
            <span className="text-sm text-slate-600 font-medium">සාමාන්‍යයි</span>
          </div>
        </div>

        {/* Poor Button */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleFeedbackSubmit('poor')}
            aria-label="Rate Poor"
            className="feedback-btn bg-gradient-to-br from-[#f51a16] to-[#c50e0a] focus-visible:ring-4 focus-visible:ring-red-400"
          >
            <div className="btn-overlay" />
            <div className="btn-content">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                <circle cx="35" cy="45" r="6" fill="#440000" />
                <circle cx="65" cy="45" r="6" fill="#440000" />
                <path
                  d="M 25 75 Q 50 55 75 75"
                  stroke="#440000"
                  strokeWidth={8}
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </button>
          <div className="text-center font-bold text-slate-700 text-lg">
            Poor <br />
            <span className="text-sm text-slate-600 font-medium">දුර්වලයි</span>
          </div>
        </div>
      </div>
    </div>
  );
}
