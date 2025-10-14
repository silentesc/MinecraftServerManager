export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getErrorMessage(error: any): string {
    return error instanceof Error ? error.message : String(error);
}
