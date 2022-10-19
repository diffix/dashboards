import { ServiceStatus } from './types';

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
