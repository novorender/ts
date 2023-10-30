export async function* streamLines(stream: ReadableStream<Uint8Array>, textDecoder = new TextDecoder("utf-8")): AsyncIterableIterator<string> {
    let reader = stream.getReader();
    let { value, done } = await reader.read();
    let chunk = value ? textDecoder.decode(value, { stream: true }) : "";

    const re = /\r\n|\n|\r/gm;
    let startIndex = 0;
    for (; ;) {
        const result = re.exec(chunk);
        if (!result) {
            if (done) {
                break;
            }
            const remainder = chunk.substring(startIndex);
            ({ value, done } = await reader.read());
            chunk = remainder + (chunk ? textDecoder.decode(value, { stream: true }) : "");
            startIndex = re.lastIndex = 0;
            continue;
        }
        yield chunk.substring(startIndex, result.index);
        startIndex = re.lastIndex;
    }
    if (startIndex < chunk.length && chunk.trim().length) {
        // last line didn't end in a newline char
        yield chunk.substring(startIndex);
    }
}
