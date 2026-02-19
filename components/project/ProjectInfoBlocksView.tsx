"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type ProjectInfoQuestionOption = { id: string; label: string };
export type ProjectInfoQuestionBlock = {
  type: "question";
  id: string;
  prompt: string;
  options: [ProjectInfoQuestionOption, ProjectInfoQuestionOption];
  required?: boolean;
};
export type ProjectInfoSectionBlock = { type: "section"; title: string; body: string };
export type ProjectInfoBlock = ProjectInfoSectionBlock | ProjectInfoQuestionBlock;

type Props = {
  blocks: ProjectInfoBlock[];
  answers?: Record<string, string>;
  onAnswerChange?: (questionId: string, nextValue: string) => void;
  interactive?: boolean;
  showRequiredState?: boolean;
  questionRequiredLabel?: string;
  questionRefs?: React.MutableRefObject<Record<string, HTMLElement | null>>;
  wrapperClassName?: string;
};

export default function ProjectInfoBlocksView({
  blocks,
  answers,
  onAnswerChange,
  interactive = true,
  showRequiredState = true,
  questionRequiredLabel = "mandatory question",
  questionRefs,
  wrapperClassName,
}: Props) {
  return (
    <div className={cn("space-y-6", wrapperClassName)}>
      {blocks.map((b, idx) => {
        if (b.type === "section") {
          return (
            <section
              key={`sec-${idx}-${b.title}`}
              className="w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{b.title}</h3>
              <div className="text-gray-800 leading-relaxed whitespace-pre-line">{b.body}</div>
            </section>
          );
        }

        const selected = answers?.[b.id] || "";
        const requiredMissing = (b.required ?? true) && !selected;
        return (
          <section
            key={`q-${b.id}`}
            ref={(el) => {
              if (questionRefs) questionRefs.current[b.id] = el;
            }}
            className={cn(
              "w-full rounded-lg border bg-white p-6 shadow-sm",
              showRequiredState && requiredMissing ? "border-yellow-300" : "border-gray-200"
            )}
          >
            <h4 className="text-lg font-semibold text-gray-900 mb-3">{b.prompt}</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              {b.options.map((opt) => {
                const checked = selected === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-4 py-3 select-none",
                      interactive ? "cursor-pointer" : "cursor-default",
                      checked ? "border-blue-600 ring-2 ring-blue-100" : "border-gray-300 hover:border-gray-400"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      disabled={!interactive}
                      onChange={() => {
                        if (!interactive || !onAnswerChange) return;
                        onAnswerChange(b.id, checked ? "" : opt.id);
                      }}
                    />
                    <span className="text-gray-900">{opt.label}</span>
                  </label>
                );
              })}
            </div>
            {showRequiredState && requiredMissing && (
              <p className="mt-2 text-sm text-amber-700">{questionRequiredLabel}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
