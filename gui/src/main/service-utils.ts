import os from 'os';
import { ServiceStatus } from '../types';

export function waitForServiceStatus(
  status: ServiceStatus,
  serviceName: string,
  getStatus: () => ServiceStatus,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let trials = 0;
    const check = () => {
      if (getStatus() === status) {
        resolve();
      } else if (trials >= 50) {
        console.error(`${serviceName} didn't reach awaited status, tried ${trials} times`);
        reject();
      } else {
        setTimeout(check, 100);
        trials++;
      }
    };
    check();
  });
}

export function getUsername(): string {
  return os.userInfo().username;
}

export function forwardLogLines(dest: (...params: string[]) => void, prefix: string, logs: string): void {
  logs
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((line) => dest(prefix, line));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
