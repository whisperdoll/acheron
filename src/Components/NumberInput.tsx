import React, { useEffect, useState } from "react"

interface Props
{
    max?: number;
    min?: number;
    step?: number;
    onChange: (value: number) => any;
    coerce?: (value: number) => number;
    value: number;
}

export default function NumberInput(props: Props)
{
    const [ savedValue, setSavedValue ] = useState<string | number>(props.value);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>)
    {
        let value = parseFloat(e.currentTarget.value);
        if (!isNaN(value))
        {
            if (props.coerce)
            {
                value = props.coerce(value);
            }
            props.onChange(value);
        }
        setSavedValue(e.currentTarget.value);
    }

    useEffect(() =>
    {
        setSavedValue(props.value);
    }, [ props.value ]);

    return (
        <input
            type="number"
            min={props.min}
            max={props.max}
            step={props.step}
            onChange={handleChange}
            value={savedValue}
        />
    );
}
