import { GhostButton, PrimaryButton } from '../components/Button';

type LandingPageProps = {
  onNavigate?: (page: 'landing' | 'dashboard' | 'contact') => void;
};

const LandingPage = ({ onNavigate }: LandingPageProps) => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-gray-50 to-gray-100 py-20 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle at 30% 12%, rgba(27, 106, 213, 0.12), transparent 44%), radial-gradient(circle at 80% 18%, rgba(27, 106, 213, 0.08), transparent 42%)',
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-blue-900">
            NEXT-GENERATION HEALTHCARE PLATFORM
          </p>
          <h1 className="mb-6 text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Your AI-Powered
            <br />
            Healthcare Intelligence
            <br />
            Platform
          </h1>
          <p className="mb-8 mx-auto max-w-2xl text-lg leading-relaxed text-gray-600">
            Combining AI diagnostics, blockchain verification, and patient digital twin
            functionality for medical professionals. Make informed decisions with real-time
            analytics and secure, transparent health data.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <PrimaryButton onClick={() => onNavigate?.('dashboard')}>Launch Dashboard →</PrimaryButton>
            <GhostButton href="#learn-more">Learn More →</GhostButton>
          </div>
        </div>
      </section>

      {/* AI Diagnostic Engine Section */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                AI DIAGNOSTIC ENGINE
              </p>
              <h2 className="mb-6 text-3xl font-bold text-gray-900 lg:text-4xl">
                Personalized insights in a dedicated diagnostic workspace
              </h2>
              <p className="mb-8 text-gray-600 leading-relaxed">
                The Pulse Ledger turns your patient data into structured insights—summarizes
                possible contributing factors, and clear next-step recommendations. When you're
                ready, continue the analysis on our focused diagnostic dashboard.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition">
                  Open Dashboard
                </button>
                <button className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-6 py-3 rounded-lg font-semibold transition">
                  See how it works
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-gray-700">
                  "Patient vitals showing elevated markers. AI analysis suggests monitoring
                  cardiovascular indicators closely over next 48 hours."
                </p>
              </div>
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <p className="text-sm text-gray-700">
                  "Biomarker trend analysis: Slight elevation in inflammatory markers. Recommend
                  hydration protocol and follow-up assessment if levels persist."
                </p>
              </div>
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                <p className="text-sm text-gray-700">
                  "Predictive model indicates 87% probability of standard recovery timeline.
                  Continue current treatment regimen with routine monitoring."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted Data Sources Section */}
      <section className="bg-gradient-to-b from-gray-50 to-gray-100 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              TRUSTED DATA SOURCES
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Verified medical guidance for
              <br />
              continued learning
            </h2>
            <p className="text-gray-600 max-w-2xl">
              Dive deeper into reliable health information handpicked from
              <br />
              government and global health agencies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Medical Research Consortiums
              </h3>
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                Official universities, disease surveillance, and public health programs from leading
                medical institutions worldwide.
              </p>
              <a
                href="#"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Explore Sources →
              </a>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Global Health Organizations
              </h3>
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                Global health guidance, outbreak updates, research, and evidence-based protocols
                from WHO and CDC.
              </p>
              <a
                href="#"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                View Organizations →
              </a>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Clinical Data Networks</h3>
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                Peer-to-peer care guidance, clinical protocols, and in-depth data on medical
                conditions and treatments.
              </p>
              <a
                href="#"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Access Network →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              HOW IT WORKS
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Intelligent healthcare in three steps
            </h2>
            <p className="text-gray-600 max-w-3xl">
              Powered by advanced AI models and blockchain technology, The Pulse Ledger provides
              clarity and actionable insights in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full text-xl font-bold mb-6">
                1
              </div>
              <div className="mb-6">
                <svg
                  className="w-16 h-16 text-gray-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232 1.232 3.227 0 4.458s-3.227 1.232-4.458 0l-1.904-1.904a4.002 4.002 0 01-5.68 0l-1.904 1.904c-1.232 1.232-3.227 1.232-4.458 0s-1.232-3.227 0-4.458L5 14.5"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Monitor patient vitals</h3>
              <p className="text-gray-600 leading-relaxed">
                Real-time AI diagnostics analyze patient data, detect anomalies, and provide instant
                health insights with predictive accuracy.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full text-xl font-bold mb-6">
                2
              </div>
              <div className="mb-6">
                <svg
                  className="w-16 h-16 text-gray-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Blockchain verification</h3>
              <p className="text-gray-600 leading-relaxed">
                Every medical record is cryptographically verified and stored on distributed
                ledgers, ensuring data integrity and transparency.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full text-xl font-bold mb-6">
                3
              </div>
              <div className="mb-6">
                <svg
                  className="w-16 h-16 text-gray-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Get predictive insights</h3>
              <p className="text-gray-600 leading-relaxed">
                AI-powered forecasting analyzes workload patterns, optimizes resource allocation,
                and helps prevent critical situations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About The Pulse Ledger Section */}
      <section className="bg-gradient-to-b from-gray-50 to-gray-100 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              ABOUT THE PULSE LEDGER
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4 lg:text-4xl">
              AI-powered medical intelligence that meets
              <br />
              you where you are
            </h2>
            <p className="text-gray-600 max-w-4xl mx-auto leading-relaxed">
              The Pulse Ledger is an AI-driven platform designed to transform patient data into
              actionable insights. It brings together blockchain verification, real-time analytics,
              and conversational AI, all designed around clinical excellence and peace of mind.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Objectives */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Objectives</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Help healthcare professionals better understand patient conditions.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Provide AI-driven, evidence-based diagnostic guidance.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Reduce unnecessary clinical visits for routine assessments.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Educate users with preventive health insights.
                  </span>
                </li>
              </ul>
            </div>

            {/* Target Users */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Target Users</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Medical professionals seeking data-driven diagnostic support.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Healthcare institutions needing blockchain-verified records.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Clinical teams requiring real-time patient monitoring.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Research organizations analyzing health trends.
                  </span>
                </li>
              </ul>
            </div>

            {/* Technology Stack */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Technology Stack</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Built with React + TypeScript for robust frontend performance.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Blockchain integration for immutable health records.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    AI/ML models for predictive diagnostics.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-gray-700">
                    Designed for HIPAA-compliant, accessible experience.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              KEY FEATURES
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Designed for fast, reliable healthcare decisions
            </h2>
            <p className="text-gray-600 max-w-3xl">
              Built on cutting-edge technology and powered by advanced AI models, The Pulse Ledger
              bridges the gap between clinical excellence and digital innovation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="mb-6">
                <svg
                  className="w-12 h-12 text-gray-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Patient digital twins</h3>
              <p className="text-gray-600 leading-relaxed">
                Create virtual patient models with biomechanical simulations for predictive
                treatment outcomes and personalized care strategies.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="mb-6">
                <svg
                  className="w-12 h-12 text-gray-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Distributed network</h3>
              <p className="text-gray-600 leading-relaxed">
                Access real-time network topology with validator nodes ensuring data consistency and
                sub-second transaction finality.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="mb-6">
                <svg
                  className="w-12 h-12 text-gray-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Secure & compliant</h3>
              <p className="text-gray-600 leading-relaxed">
                HIPAA-compliant architecture with smart contract permissions, multi-signature
                verification, and end-to-end encryption.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-gray-50 rounded-lg p-8">
              <div className="mb-6">
                <svg
                  className="w-12 h-12 text-gray-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Lightning-fast insights</h3>
              <p className="text-gray-600 leading-relaxed">
                Real-time data processing with AI-powered analytics delivers instant insights for
                rapid clinical decision-making.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-2xl p-12 text-center shadow-xl">
            <h2 className="text-3xl font-bold text-white mb-4 lg:text-4xl">
              Ready to transform your healthcare workflow?
            </h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              Join leading medical institutions using The Pulse Ledger for AI-powered diagnostics
              and blockchain-verified patient data.
            </p>
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg transition shadow-lg hover:shadow-xl">
              Get Started Now →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
