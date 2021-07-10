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

    function emitChange(value: number)
    {
        if (value !== props.value)
        {
            props.onChange(value);
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>)
    {
        let value = parseFloat(e.currentTarget.value);
        if (!isNaN(value))
        {
            if (props.coerce)
            {
                value = props.coerce(value);
            }
            emitChange(value);
        }
        setSavedValue(e.currentTarget.value);
    }

    useEffect(() =>
    {
        if (props.max !== undefined && props.value > props.max)
        {
            emitChange(props.max);
        }
    }, [ props.max ]);


    useEffect(() =>
    {
        if (props.min !== undefined && props.value < props.min)
        {
            emitChange(props.min);
        }
    }, [ props.min ]);

    useEffect(() =>
    {
        setSavedValue(props.value);
    }, [ props.value ]);

    function increment()
    {
        const step = props.step ?? 1;
        let value = props.value + step;
        if (props.max !== undefined && value > props.max)
        {
            value = props.max;
        }
        if (props.coerce)
        {
            value = props.coerce(value);
        }
        if (!isNaN(value))
        {
            emitChange(value);
        }
    }

    function decrement()
    {
        const step = props.step ?? 1;
        let value = props.value - step;
        if (props.min !== undefined && value < props.min)
        {
            value = props.min;
        }
        if (props.coerce)
        {
            value = props.coerce(value);
        }
        if (!isNaN(value))
        {
            emitChange(value);
        }
    }

    return (
        <div className="numberInput-container">
            <input
                className="numberInput"
                type="number"
                min={props.min}
                max={props.max}
                step={props.step}
                onChange={handleChange}
                value={savedValue}
            />
            <div className="numberInput-buttons">
                <button className="numberInput-up" onClick={increment}>▲</button>
                <button className="numberInput-down" onClick={decrement}>▼</button>
            </div>
        </div>
    );
}
