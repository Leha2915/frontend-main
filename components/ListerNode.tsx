import React, { FC, HTMLAttributes } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { cn } from '@/lib/utils'
import { NodeOrigin, Position, XYPosition, Node as Nodes, NodeTypes, Handle } from "@xyflow/react";


interface ListerNodeProps {
    data: {
        listElements: string[],
        header: string,
        className: string,
    },
}

const ListerNode: FC<ListerNodeProps> = ({ data }) => {

    return (
        <>
            <Handle
                type="target"
                position={Position.Top}
            />
            <div className={cn("border rounded border-black ", data.className)}>
                <p className='m-4 text-lg font-semibold'>
                    {data.header}
                </p>

                {data.listElements.map((element, index) => {
                    return (
                        <div className="mx-4 my-2 border rounded border-black" key={index}>
                            <p className='p-2 '>
                                {element}
                            </p>
                        </div>
                    )
                })}




            </div>





            <Handle
                type="source"
                position={Position.Bottom}
            />
        </>



    )
}


export default ListerNode