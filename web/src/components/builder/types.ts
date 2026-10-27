/** Runs an API call, reports any error, then refreshes the resume and its preview. Resolves to whether it succeeded. */
export type Mutate = (action: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;
