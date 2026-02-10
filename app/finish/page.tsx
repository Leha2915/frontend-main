"use client";

import { useEffect, useState } from "react";
import RequireAuthLevel from "@/components/RequireAuthLevel";

const api_url = process.env.NEXT_PUBLIC_API_URL;

type FinishCopy = {
  finish_next_title?: string | null;
  finish_next_body?: string | null;
  finish_next_link?: string | null;
};

export default function FinishPage() {
  const [finishTitle, setFinishTitle] = useState<string | null>(null);
  const [finishBody, setFinishBody] = useState<string | null>(null);
  const [finishLink, setFinishLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const slug = localStorage.getItem("project");
    if (!slug) {
      setError("Missing project slug for finish page.");
      return;
    }
    if (!api_url) {
      setError("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${api_url}/projects/${slug}`);
        if (!res.ok) {
          throw new Error(`Failed to load project details (status ${res.status}).`);
        }
        const project = (await res.json()) as FinishCopy;

        const title = project.finish_next_title?.trim();
        const body = project.finish_next_body?.trim();
        const link = project.finish_next_link?.trim();

        if (!title || !body || !link) {
          throw new Error("Finish page copy is missing in project configuration.");
        }

        setFinishTitle(title);
        setFinishBody(body);
        setFinishLink(link);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load finish page copy.");
      }
    })();
  }, []);

  if (error) {
    throw new Error(error);
  }

  if (!finishTitle || !finishBody || !finishLink) {
    return null;
  }

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
            Thank you for participating in this laddering interview session.
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
                  {finishTitle}
                </h3>
                <p className="text-gray-700 text-base leading-relaxed">
                  {finishBody}
                </p>
                <a
                  href={finishLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-medium hover:underline break-all"
                >
                  {finishLink}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RequireAuthLevel>
  );
}
