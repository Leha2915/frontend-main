import { cn } from "@/lib/utils";
import { Badge } from "./badge";

type StatusIndicatorProps = {
    message: string;
    //color: 'green' | 'grey' | 'red' | 'orange';
    className?: string;
    isGood: boolean;
}

const stateColors = {
    green: '#57ba72',
    grey: '#b5b5b5',
    red: '#bf4545',
    orange: '#e89c4a'
}

const states = {
    true: '#57ba72',
    false: '#f72020',
}

export default function StatusIndicator({ className, message, isGood }: StatusIndicatorProps) {
    return (
        <Badge
            variant="outline"
            className={cn("flex items-center justify-center text-center", className)}
        >

            <svg className="w-4 h-4 m-2" xmlns="http://www.w3.org/2000/svg">
                <circle r="50%" cx="50%" cy="50%" fill={
                    isGood ? stateColors.green : stateColors.red
                } />
            </svg>
            <p>{message}</p>

        </Badge>
    )
}