import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FC } from 'react';

interface StimulusProps {
  stimulus: {
    id: number;
    description: string;
  };
  rank: number;
}

const StimulusCard: FC<StimulusProps> = ({ stimulus, rank }) => {
  const { id, description } = stimulus;

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: '100%',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border border-black rounded h-full"
    >
      <div className="h-full grid grid-cols-[56px,1fr] gap-4 items-stretch">
        <div className="h-full rounded border bg-white flex items-center justify-center">
          <p className="text-xl font-bold">{rank}</p>
        </div>

        <div className="h-full rounded bg-white flex items-center px-4 py-3">
          <p className="text-black text-ls">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default StimulusCard;
