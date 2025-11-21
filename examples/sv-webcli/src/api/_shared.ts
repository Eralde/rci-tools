// dprint-ignore
export enum DETAIL_LEVEL {
  THREE_MINUTES = 0,    // 64 x 3-seconds samples ≈ 3 minutes
  ONE_HOUR = 1,         // 64 x 1-minute samples ≈ 1 hour
  THREE_HOURS = 2,      // 64 x 3-minute samples ≈ 3 hours
  ONE_DAY = 3,          // 64 x 30-minute samples ≈ 1 day
}

export interface RrdTick<TimeType = number> {
  t: TimeType;
  v: number;
}
