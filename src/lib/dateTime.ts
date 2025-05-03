"use client";
import "dayjs/locale/th";
import dayjs from "dayjs";
import bhuddhistEra from "dayjs/plugin/buddhistEra";
import localizedFormat from "dayjs/plugin/localizedFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import weekOfYear from "dayjs/plugin/weekOfYear";

// Setup dayjs for timezone support
dayjs.locale("th");
dayjs.extend(localizedFormat);
dayjs.extend(bhuddhistEra);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekOfYear);
dayjs.tz.setDefault("Asia/Bangkok");

export { dayjs };
