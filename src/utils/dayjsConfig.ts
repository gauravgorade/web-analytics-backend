import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with necessary plugins
dayjs.extend(utc);
dayjs.extend(relativeTime);

export { dayjs };
export type { Dayjs };
