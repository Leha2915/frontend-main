"use client";
import { useContext, useState, forwardRef, useImperativeHandle } from 'react';
import { ChatsContext } from '@/context/chats';
import { SettingsContext } from '@/context/settings';
import { ProgressContext } from '@/context/progress';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragEndEvent, DragStartEvent, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import StimulusSortElement from './StimulusSortElement';
import { Button } from './ui/button';
import { LockIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSessionId, getCookieName, getCookieValue, setCookie } from '@/lib/session';

type Stimulus = { id: number; description: string; };

export type StimulusSortListHandle = {
  handleContinue: () => Promise<void> | void;
};

const StimulusSortList = forwardRef<StimulusSortListHandle>((_props, ref) => {
  const router = useRouter();
  const cc = useContext(ChatsContext);
  const pc = useContext(ProgressContext);
  const sc = useContext(SettingsContext);

  const { stimuli: stimuliContext, setStimuli: setStimuliContext } = sc;

  const initialData: Stimulus[] = stimuliContext.map((description, index) => ({
    id: index + 1,
    description,
  }));

  const [list, setList] = useState<Stimulus[]>(initialData);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    const id = event.active?.id as number | undefined;
    if (id) setActiveId(id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setList((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        sc.stimuli = newOrder.map((s) => s.description);
        return newOrder;
      });
    }
    setActiveId(null);
  }

  function moveStimulus(index: number, direction: 'up' | 'down') {
    setList((items) => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= items.length) return items;
      const newOrder = arrayMove(items, index, newIndex);
      sc.stimuli = newOrder.map((s) => s.description);
      return newOrder;
    });
  }

  async function sendStimuliOrderToBackend(order: string[]) {
    const cookieName = getCookieName(sc.projectSlug);
    let sessionId = getCookieValue(cookieName);
    if (!sessionId) {
      sessionId = getSessionId(sc.projectSlug);
      setCookie(cookieName, sessionId);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const response = await fetch(`${apiUrl}/interview/save_order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_slug: sc.projectSlug, session_id: sessionId, stimuli_order: order, user_id: localStorage.getItem("ladderchat-user-id"), answers: localStorage.getItem("project_info_answers") }),
    });
    if (!response.ok) {
      console.error('Unable to save order: HTTP error');
      return;
    }
    const result = await response.json();
    if (result.status !== 'ok') {
      console.error('Unable to save order: Server returned status =', result.status);
    } else {
      console.log('Stimuli order saved successfully.');
    }
  }

  async function handleContinue() {
    const arr = Array.from(Array(sc.n_stimuli).keys());
    arr.forEach((element) => {
      if (!cc.isChatExisting('' + (element + 1))) {
        cc.chats.push({
          chatid: '' + (element + 1),
          stimulus: sc.stimuli[element],
          messages: [],
          finished: false,
          rawMessages: [],
          lastLLMTought: '',
          autoHelloSent: false
        });
      }
    });

    pc.setSubmittedRanking(true);

    const sortedOrder = list.map((s) => s.description);
    setStimuliContext(sortedOrder);

    await sendStimuliOrderToBackend(sortedOrder);
    router.push('/chat');
  }

  useImperativeHandle(ref, () => ({ handleContinue }), [list, sc, cc, pc]);


const cardShell = (
  inner: React.ReactNode,
  showTopMark: boolean,
  isHidden = false
) => (
  <div
    className={cn(
      'h-28 md:h-32 rounded-lg border border-gray-200 bg-white flex',
      showTopMark && 'border-l-4 border-l-green-400'
    )}
  >
    <div className={cn('h-full w-full flex items-center', isHidden && 'opacity-0')}>
      {inner}
    </div>
  </div>
);

  const activeStimulus = activeId ? list.find((s) => s.id === activeId) : undefined;

  return (
    <div className="h-full flex flex-col space-y-6">
      <div id="wrapper" className="w-full relative flex-1">
        <div
          className={cn(
            'flex absolute w-[calc(100%+2rem)] h-[calc(100%+2rem)] -left-4 -top-4 bg-[rgba(160,160,160,0.8)] rounded-lg z-10',
            { hidden: !pc.submittedRanking }
          )}
        >
          <LockIcon size="15%" className="mx-auto place-self-center text-gray-600" />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 h-full flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900">Stimulus Ranking</h3>

          <div className="flex-1 overflow-y-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext items={list} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {list.map((stimulus, index) => {
                    const isTop = index < sc.n_stimuli;
                    const isActive = activeId === stimulus.id;
                    return (
                      <div key={stimulus.id} className="flex items-stretch gap-3">
                        <div className="flex flex-col gap-1 self-stretch justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveStimulus(index, 'up')}
                            disabled={index === 0}
                            className="h-7 w-8 p-0 hover:bg-green-50"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveStimulus(index, 'down')}
                            disabled={index === list.length - 1}
                            className="h-7 w-8 p-0 hover:bg-green-50"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex-1">
                          {cardShell(
                            <StimulusSortElement rank={index + 1} stimulus={stimulus} />,
                            isTop,
                            isActive
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SortableContext>

            <DragOverlay dropAnimation={null}>
            {activeStimulus ? (
                <div className="z-50 pointer-events-none">
                {cardShell(
                    <StimulusSortElement
                    rank={list.findIndex((s) => s.id === activeStimulus.id) + 1}
                    stimulus={activeStimulus}
                    />,
                    false,
                    false
                )}
                </div>
            ) : null}
            </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
});

StimulusSortList.displayName = 'StimulusSortList';
export default StimulusSortList;
