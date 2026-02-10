"use client";
import { useContext, useRef } from "react";
import RequireAuthLevel from "@/components/RequireAuthLevel";
import { SettingsContext } from "@/context/settings";
import { Button } from "@/components/ui/button";
import StimulusSortList, { StimulusSortListHandle } from "@/components/StimulusSortList";
import getTranslation from "@/lib/translation";


export default function Home() {
  const sc = useContext(SettingsContext);

  const lang = sc.language;
  const sortRef = useRef<StimulusSortListHandle>(null);

  return (
    <RequireAuthLevel allowGuest>
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex h-full flex-col md:flex-row">
            <aside
              className="
                basis-0 grow-[1] shrink-0
                md:max-w-[560px] md:min-w-[280px]
                p-6 space-y-6
              "
            >
              <div className="rounded-xl border border-slate-200 bg-white/80 shadow-sm">
                <div className="border-l-4 border-l-sky-100 rounded-l-xl p-5">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {getTranslation("app_stimuli.Ranking.study_topic_title", lang)}
                  </h2>
                  <p className="mt-1 text-slate-700">{sc.topic}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white/80 shadow-sm">
                <div className="border-l-4 border-l-slate-100 rounded-l-xl p-5">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {getTranslation("app_stimuli.Ranking.about_title", lang)}
                  </h2>
                  <p
                    lang={lang}
                    className="
                      mt-2 text-slate-700 leading-relaxed
                      whitespace-pre-wrap
                      break-words
                    "
                  >
                    {sc.description}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white/80 shadow-sm">
                <div className="border-l-4 border-l-amber-100 rounded-l-xl p-5">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {getTranslation("app_stimuli.Ranking.todo_title", lang)}
                  </h3>
                  <p className="mt-2 text-slate-700">
                    {getTranslation("app_stimuli.Ranking.todo_body", lang).replace("{n}", String(sc.n_stimuli))}
                  </p>
                </div>
              </div>
            </aside>

            <main className="basis-0 grow-[1.618] border-t md:border-t-0 md:border-l border-gray-200">
              <div className="p-6">
                <StimulusSortList ref={sortRef} />
              </div>
            </main>
          </div>
        </div>

        <div className="border-t border-gray-200 p-6">
          <Button
            className="w-full h-12 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => sortRef.current?.handleContinue()}
          >
            {getTranslation("app_stimuli.Ranking.submit_button", lang)}
          </Button>
        </div>
      </div>
    </RequireAuthLevel>
  );
}
