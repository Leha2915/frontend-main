"use client";

import RequireAuthLevel from "@/components/RequireAuthLevel";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const AnalyticsLazy = dynamic(
  () => import("@/app/analytics/page").then((m) => m.default),
  { ssr: false }
);

export default function FinishPage() {
  return (
    <RequireAuthLevel allowGuest>
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="w-full max-w-lg mx-auto text-center">

          <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Interview Complete!
          </h1>
          <p className="text-lg text-gray-600 mb-6 leading-relaxed">
            Thank you for participating in this laddering interview session. You
            completed part 1.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>

              <div>
                <h3 className="text-base font-semibold text-blue-900 mb-1">
                  What happens next?
                </h3>
                <p className="text-gray-700 text-base leading-relaxed">
                  Please continue with the next part of the study by following this link:
                </p>
                <a
                  href="https://survey.iism.kit.edu/index.php/821265?newtest=Y&lang=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-medium hover:underline break-all"
                >
                  https://survey.iism.kit.edu/index.php/821265?newtest=Y&lang=en
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RequireAuthLevel>
  );
}
