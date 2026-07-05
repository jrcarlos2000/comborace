function stamp(): string {
  return new Date().toISOString();
}

export const log = {
  info(msg: string, ...rest: unknown[]): void {
    console.log(`${stamp()} ${msg}`, ...rest);
  },
  warn(msg: string, ...rest: unknown[]): void {
    console.warn(`${stamp()} WARN ${msg}`, ...rest);
  },
  error(msg: string, ...rest: unknown[]): void {
    console.error(`${stamp()} ERROR ${msg}`, ...rest);
  },
};
