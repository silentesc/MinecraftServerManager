export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getErrorMessage(error: any): string {
    return error instanceof Error ? error.message : String(error);
}

export function roundTo(num: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
}
