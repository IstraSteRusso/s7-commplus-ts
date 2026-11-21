import { describe, it, expect } from "vitest";
import {
  ByteStream, PValue, ItemAddress, PlcTagQC, Softdatatype, tagFactory,
  PlcTag, PlcTagBool, PlcTagByte, PlcTagWord, PlcTagDWord, PlcTagLWord, PlcTagUSInt, PlcTagSInt, PlcTagUInt, PlcTagInt,
  PlcTagUDInt, PlcTagDInt, PlcTagULInt, PlcTagLInt, PlcTagReal, PlcTagLReal, PlcTagTime, PlcTagLTime, PlcTagS5Time,
  PlcTagDate, PlcTagDateAndTime, PlcTagLDT, PlcTagTimeOfDay, PlcTagLTOD, PlcTagDTL, PlcTagChar, PlcTagWChar,
  PlcTagString, PlcTagWString, PlcTagPointer, PlcTagAny,
  PlcTagBoolArray, PlcTagByteArray, PlcTagWordArray, PlcTagIntArray, PlcTagDWordArray, PlcTagDIntArray,
  PlcTagRealArray, PlcTagUSIntArray, PlcTagUIntArray, PlcTagUDIntArray, PlcTagSIntArray,
  PlcTagDateAndTimeArray, PlcTagStringArray,
  ValueBool, ValueUSIntArray, ValueUIntArray, ValueStruct, ValueByteArray, ValueDInt, ValueUInt, ValueWord,
} from "../src/index.js";

const addr = (): ItemAddress => new ItemAddress("8A0E000F.9");
const dt = 0;

/** Serialize + deserialize, as it happens on the wire */
const rt = (v: PValue): PValue => {
  const b = new ByteStream();
  v.serialize(b);
  b.position = 0;
  return PValue.deserialize(b)!;
};

/** Writes the tag, sends the PValue over the (simulated) wire and feeds it into a fresh tag's processReadResult */
function roundTrip<T extends PlcTag>(src: T, dst: T): T {
  dst.processReadResult(rt(src.getWriteValue()), 0n);
  expect(dst.quality).toBe(PlcTagQC.TAG_QUALITY_GOOD);
  return dst;
}

/** Runs fn with the time zone of the PC set to tz (Node applies a new process.env.TZ at once) */
function inTimeZone(tz: string, fn: () => void): void {
  const saved = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
}

describe("scalar PlcTags round trip", () => {
  const cases: Array<[string, () => PlcTag & { value: any }, any[]]> = [
    ["Byte", () => new PlcTagByte("t", addr(), dt), [0x00, 0x01, 0x55, 0xaa, 0xff]],
    ["Word", () => new PlcTagWord("t", addr(), dt), [0x0000, 0x0001, 0xa5a5, 0x5a5a, 0xffff]],
    ["DWord", () => new PlcTagDWord("t", addr(), dt), [0, 1, 0xa5a5a5a5, 0x5a5a5a5a, 0xffffffff]],
    ["LWord", () => new PlcTagLWord("t", addr(), dt), [0n, 1n, 0xa5a5a5a5a5a5a5a5n, 0x5a5a5a5a5a5a5a5an, 0xffffffffffffffffn]],
    ["USInt", () => new PlcTagUSInt("t", addr(), dt), [0, 1, 123, 210, 255]],
    ["SInt", () => new PlcTagSInt("t", addr(), dt), [-128, 0, 1, 123, 127]],
    ["UInt", () => new PlcTagUInt("t", addr(), dt), [0, 1, 12345, 4321, 65535]],
    ["Int", () => new PlcTagInt("t", addr(), dt), [-32768, -12345, 0, 12345, 32767]],
    ["UDInt", () => new PlcTagUDInt("t", addr(), dt), [0, 1, 127, 128, 255, 256, 1234567, 4294967295]],
    ["DInt", () => new PlcTagDInt("t", addr(), dt), [-2147483648, -256, -255, -128, -127, 0, 127, 128, 255, 256, 2147483647]],
    ["ULInt", () => new PlcTagULInt("t", addr(), dt), [0n, 127n, 128n, 255n, 256n, 0x00ffffffffffffffn, 0x0100000000000000n, 0x0100000000000001n, 0xffffffffffffffffn]],
    ["LInt", () => new PlcTagLInt("t", addr(), dt), [-9223372036854775808n, -256n, -255n, -128n, -127n, 0n, 127n, 128n, 255n, 256n, 0x007fffffffffffffn, 0x0080000000000000n, 9223372036854775807n]],
    ["Real", () => new PlcTagReal("t", addr(), dt), [-3.4028234663852886e38, -Infinity, Infinity, -1234.5, 0, 0.125, 3.4028234663852886e38]],
    ["LReal", () => new PlcTagLReal("t", addr(), dt), [-Number.MAX_VALUE, -Infinity, Infinity, -1234.5, 0, 0.125, Number.MAX_VALUE, 123.456789]],
    ["Time", () => new PlcTagTime("t", addr(), dt), [-2147483648, -256, -255, -128, -127, 0, 127, 128, 255, 256, 2147483647]],
    ["LTime", () => new PlcTagLTime("t", addr(), dt), [-9223372036854775808n, -256n, 0n, 256n, 0x007fffffffffffffn, 0x0080000000000000n, 9223372036854775807n]],
    ["LDT", () => new PlcTagLDT("t", addr(), dt), [0n, 127n, 128n, 255n, 256n, 0x00ffffffffffffffn, 0x0100000000000000n, 0xffffffffffffffffn]],
    ["TimeOfDay", () => new PlcTagTimeOfDay("t", addr(), dt), [0, 1, 123456, 86400000 - 1]],
    ["LTOD", () => new PlcTagLTOD("t", addr(), dt), [0n, 1234n, 1234567890n, 86400000000000n - 1n]],
    ["Char", () => new PlcTagChar("t", addr(), dt), ["A", "B", " ", "ä", "1"]],
    ["WChar", () => new PlcTagWChar("t", addr(), dt), ["A", "B", " ", "ä", "1", "Ʃ"]],
  ];
  for (const [name, mk, values] of cases) {
    it(name, () => {
      for (const v of values) {
        const src = mk();
        src.value = v;
        const dst = roundTrip(src, mk());
        expect(dst.value).toBe(v);
      }
    });
  }

  it("Bool", () => {
    for (const v of [true, false]) {
      const src = new PlcTagBool("t", addr(), dt);
      src.value = v;
      expect(roundTrip(src, new PlcTagBool("t", addr(), dt)).value).toBe(v);
    }
  });

  it("64 bit types stay bigint", () => {
    const t = new PlcTagLInt("t", addr(), dt);
    t.value = 9223372036854775807n;
    const back = roundTrip(t, new PlcTagLInt("t", addr(), dt));
    expect(typeof back.value).toBe("bigint");
  });
});

describe("PlcTag read error handling", () => {
  it("sets quality BAD on error or wrong type", () => {
    const t = new PlcTagInt("t", addr(), dt);
    expect(t.quality).toBe(PlcTagQC.TAG_QUALITY_WAITING_FOR_INITIAL_DATA);
    t.processReadResult(new ValueDInt(5), 0n);
    expect(t.quality).toBe(PlcTagQC.TAG_QUALITY_BAD);
    t.processReadResult(new ValueBool(true), 0n);
    expect(t.quality).toBe(PlcTagQC.TAG_QUALITY_BAD);
    t.processReadResult(undefined, 0n);
    expect(t.quality).toBe(PlcTagQC.TAG_QUALITY_BAD);
    t.processReadResult(rt(new PlcTagInt("x", addr(), dt).getWriteValue()), 7n);
    expect(t.quality).toBe(PlcTagQC.TAG_QUALITY_BAD);
    expect(t.lastReadError).toBe(7n);
  });

  it("toString is prefixed with the quality code", () => {
    const t = new PlcTagInt("t", addr(), dt);
    t.value = 42;
    t.quality = PlcTagQC.TAG_QUALITY_GOOD;
    expect(t.toString().endsWith(": 42")).toBe(true);
  });
});

describe("S5Time", () => {
  it("round trips (TimeValue, TimeBase) as BCD", () => {
    for (const [tv, tb] of [[0, 0], [1, 1], [999, 0], [10, 1], [123, 2], [999, 3]]) {
      const src = new PlcTagS5Time("t", addr(), dt);
      src.timeValue = tv;
      src.timeBase = tb;
      const dst = roundTrip(src, new PlcTagS5Time("t", addr(), dt));
      expect([dst.timeValue, dst.timeBase]).toEqual([tv, tb]);
    }
  });

  it("matches the known BCD encodings", () => {
    const t = new PlcTagS5Time("t", addr(), dt);
    t.processReadResult(new ValueWord(2457), 0n); // 9S_990MS: 0x0999 = base 0 (10ms), value 999
    expect([t.timeValue, t.timeBase]).toEqual([999, 0]);
    t.processReadResult(new ValueWord(14745), 0n); // 2H_46M_30S: base 3 (10s), value 999 -> 0x3999
    expect([t.timeValue, t.timeBase]).toEqual([999, 3]);
    t.timeValue = 123;
    t.timeBase = 2;
    expect((t.getWriteValue() as any).getValue()).toBe(0x2123);
  });

  it("rejects out of range values", () => {
    const t = new PlcTagS5Time("t", addr(), dt);
    expect(() => (t.timeValue = 1000)).toThrow(RangeError);
    expect(() => (t.timeBase = 4)).toThrow(RangeError);
  });

  it("has a value in milliseconds, like Time", () => {
    const t = new PlcTagS5Time("t", addr(), dt);
    t.processReadResult(new ValueWord(2457), 0n); // S5T#9S990MS: base 0 (10ms), value 999
    expect(t.value).toBe(9990);
    t.processReadResult(new ValueWord(14745), 0n); // S5T#2H46M30S: base 3 (10s), value 999
    expect(t.value).toBe(9990000);
    // writing picks the finest time base that holds the value exactly
    const cases = [[0, 0, 0], [9990, 999, 0], [10000, 100, 1], [12300, 123, 1], [100000, 100, 2], [9990000, 999, 3]];
    for (const [ms, tv, tb] of cases) {
      t.value = ms;
      expect([t.timeValue, t.timeBase]).toEqual([tv, tb]);
      expect(t.value).toBe(ms);
    }
    t.value = 12300;
    expect((t.getWriteValue() as any).getValue()).toBe(0x1123); // S5T#12S300MS = W#16#1123
  });

  it("rejects milliseconds that S5Time cannot hold exactly", () => {
    const t = new PlcTagS5Time("t", addr(), dt);
    for (const ms of [-10, 5, 12345, 9990001, 10000000, NaN]) {
      expect(() => (t.value = ms)).toThrow(RangeError);
    }
  });
});

describe("Date types", () => {
  it("Date", () => {
    for (const d of [new Date(1990, 0, 1), new Date(2023, 11, 23), new Date(2169, 5, 6), new Date(2000, 1, 29)]) {
      const src = new PlcTagDate("t", addr(), dt);
      src.value = d;
      const w = src.getWriteValue();
      expect(w.constructor).toBe(ValueUInt);
      expect(roundTrip(src, new PlcTagDate("t", addr(), dt)).value.getTime()).toBe(d.getTime());
    }
    const t = new PlcTagDate("t", addr(), dt);
    t.value = new Date(1990, 0, 2);
    expect((t.getWriteValue() as any).getValue()).toBe(1);
    expect(() => (t.value = new Date(1989, 11, 31))).toThrow(RangeError);
    expect(() => (t.value = new Date(2169, 5, 7))).toThrow(RangeError);
  });

  it("Date as ISO text, without time and time zone", () => {
    // the same date in any time zone of the PC; in Santiago 2026-09-06 has no midnight (the clock jumps to 01:00)
    for (const tz of ["Europe/Rome", "America/New_York", "America/Santiago", "UTC"]) {
      inTimeZone(tz, () => {
        const t = new PlcTagDate("t", addr(), dt);
        t.processReadResult(new ValueUInt(13149), 0n); // D#2026-01-01: 13149 days after 1990-01-01
        expect(t.toISOString()).toBe("2026-01-01");
        t.fromISOString("2024-01-03");
        expect((t.getWriteValue() as any).getValue()).toBe(12420);
        t.fromISOString("2026-09-06");
        expect((t.getWriteValue() as any).getValue()).toBe(13397);
        expect(t.toISOString()).toBe("2026-09-06");
      });
    }
  });

  it("Date refuses text that is not a date in its range", () => {
    const t = new PlcTagDate("t", addr(), dt);
    t.fromISOString("1990-01-01"); // the first Date
    t.fromISOString("2169-06-06"); // the last Date
    const texts = ["abc", "2026-1-1", "01-01-2026", "2026-01-01T00:00:00Z", "2026-02-30", "1989-12-31", "2169-06-07"];
    for (const text of texts) {
      expect(() => t.fromISOString(text)).toThrow(RangeError);
    }
  });

  it("DateAndTime keeps millisecond precision", () => {
    for (const d of [new Date(1990, 0, 1), new Date(2023, 11, 23, 1, 2, 3, 123), new Date(2089, 11, 31, 23, 59, 59, 999), new Date(2000, 0, 1, 0, 0, 0, 7)]) {
      const src = new PlcTagDateAndTime("t", addr(), dt);
      src.value = d;
      expect(roundTrip(src, new PlcTagDateAndTime("t", addr(), dt)).value.getTime()).toBe(d.getTime());
    }
  });

  it("DateAndTime BCD layout", () => {
    const t = new PlcTagDateAndTime("t", addr(), dt);
    t.value = new Date(2023, 11, 23, 1, 2, 3, 123);
    // the last byte: the last digit of the milliseconds (3) and the weekday (7 = Saturday)
    expect(Array.from((t.getWriteValue() as ValueUSIntArray).getValue())).toEqual([0x23, 0x12, 0x23, 0x01, 0x02, 0x03, 0x12, 0x37]);
    expect(() => (t.value = new Date(2090, 0, 1))).toThrow(RangeError);
  });

  it("DateAndTime as ISO text in a time zone", () => {
    inTimeZone("Europe/Rome", () => {
      const t = new PlcTagDateAndTime("t", addr(), dt);
      const read = (bytes: number[]) => t.processReadResult(new ValueUSIntArray(new Uint8Array(bytes)), 0n);
      // DT#2026-11-21-21:03:10.344 as the PLC sends it (BCD); the last byte: 4 (milliseconds) and 7 (Saturday)
      read([0x26, 0x11, 0x21, 0x21, 0x03, 0x10, 0x34, 0x47]);
      expect(t.toISOString("Europe/Rome")).toBe("2026-11-21T20:03:10.344Z"); // a PLC with RD_LOC_T
      expect(t.toISOString("UTC")).toBe("2026-11-21T21:03:10.344Z"); // a PLC with RD_SYS_T
      expect(t.toISOString()).toBe("2026-11-21T20:03:10.344Z"); // no time zone: the one of the PC
      // 02:30 on 2026-10-25 comes twice in Rome: the first one is taken
      read([0x26, 0x10, 0x25, 0x02, 0x30, 0x00, 0x00, 0x01]);
      expect(t.toISOString("Europe/Rome")).toBe("2026-10-25T00:30:00.000Z");
      // 02:30 on 2026-03-29 does not exist in Rome, but it does in UTC: the digits must not move
      read([0x26, 0x03, 0x29, 0x02, 0x30, 0x00, 0x00, 0x01]);
      expect(t.toISOString("UTC")).toBe("2026-03-29T02:30:00.000Z");
    });
  });

  it("DateAndTime from ISO text in a time zone", () => {
    inTimeZone("Europe/Rome", () => {
      const t = new PlcTagDateAndTime("t", addr(), dt);
      const bytes = () => Array.from((t.getWriteValue() as ValueUSIntArray).getValue());
      t.fromISOString("2026-11-21T20:03:10.344Z", "Europe/Rome");
      expect(bytes()).toEqual([0x26, 0x11, 0x21, 0x21, 0x03, 0x10, 0x34, 0x47]); // 21:03 in Rome
      t.fromISOString("2026-11-21T20:03:10.344Z", "UTC");
      expect(bytes()).toEqual([0x26, 0x11, 0x21, 0x20, 0x03, 0x10, 0x34, 0x47]); // 20:03 in UTC
      // the weekday of the digits: Saturday 23:30 in UTC is already Sunday 00:30 in Rome
      t.fromISOString("2026-11-21T23:30:00Z", "UTC");
      expect(bytes()[7]).toBe(0x07);
      t.fromISOString("2026-11-21T23:30:00Z", "Europe/Rome");
      expect(bytes()[7]).toBe(0x01);
      // 02:30 on 2026-03-29 does not exist in Rome, but it does in UTC
      t.fromISOString("2026-03-29T02:30:00Z", "UTC");
      expect(bytes().slice(0, 4)).toEqual([0x26, 0x03, 0x29, 0x02]);
    });
  });

  it("DateAndTime refuses text that is not a valid UTC time in its range", () => {
    const t = new PlcTagDateAndTime("t", addr(), dt);
    t.fromISOString("1990-01-01T00:00:00Z", "UTC"); // the first DT
    t.fromISOString("2089-12-31T23:59:59.999Z", "UTC"); // the last DT
    const texts = [
      "abc", "2026-11-21T20:03:10", "2026-11-21T20:03:10.3441Z", "2026-02-30T10:00:00Z",
      "1989-12-31T23:59:59.999Z", "2090-01-01T00:00:00Z",
    ];
    for (const text of texts) {
      expect(() => t.fromISOString(text, "UTC")).toThrow(RangeError);
    }
    expect(() => t.toISOString("Rome")).toThrow(RangeError); // not a time zone
  });

  it("TimeOfDay string and range", () => {
    const t = new PlcTagTimeOfDay("t", addr(), dt);
    t.value = 3723000;
    expect(t.toString().endsWith(": 01:02:03")).toBe(true);
    t.value = 3723004;
    expect(t.toString().endsWith(": 01:02:03.004")).toBe(true);
    expect(() => (t.value = 86400000)).toThrow(RangeError);
  });

  it("LTOD range", () => {
    const t = new PlcTagLTOD("t", addr(), dt);
    expect(() => (t.value = 86400000000000n)).toThrow(RangeError);
    expect(() => (t.value = -1n)).toThrow(RangeError);
  });

  it("TimeOfDay range", () => {
    const t = new PlcTagTimeOfDay("t", addr(), dt);
    for (const v of [86400000, -1, 1.5, NaN]) {
      expect(() => (t.value = v)).toThrow(RangeError);
    }
  });

  it("DTL round trips date and nanoseconds", () => {
    const cases: Array<[Date, number]> = [
      [new Date(1970, 0, 1), 0],
      [new Date(2023, 11, 23, 1, 2, 3, 0), 123456789],
      [new Date(2089, 11, 31, 23, 59, 59, 0), 999999999],
      [new Date(2262, 3, 11, 23, 47, 16, 0), 854775807],
    ];
    for (const [d, ns] of cases) {
      const src = new PlcTagDTL("t", addr(), dt);
      src.value = d;
      src.valueNanosecond = ns;
      const w = rt(src.getWriteValue()) as ValueStruct;
      expect(w.packedStructInterfaceTimestamp).toBe(src.dtlInterfaceTimestamp);
      const dst = new PlcTagDTL("t", addr(), dt);
      dst.processReadResult(w, 0n);
      expect(dst.quality).toBe(PlcTagQC.TAG_QUALITY_GOOD);
      expect(dst.value.getTime()).toBe(d.getTime());
      expect(dst.valueNanosecond).toBe(ns);
      expect(dst.dtlInterfaceTimestamp).toBe(src.dtlInterfaceTimestamp);
    }
  });

  it("DTL as ISO text in UTC, with the nanoseconds", () => {
    inTimeZone("Europe/Rome", () => {
      const t = new PlcTagDTL("t", addr(), dt);
      // DTL#2026-11-21-11:14:43.755616051 as the PLC sends it: year (2 bytes), month, day, weekday (7 = Saturday),
      // hour, minute, second, nanosecond (4 bytes)
      const bytes = [0x07, 0xea, 11, 21, 7, 11, 14, 43, 0x2d, 0x09, 0xc9, 0x33];
      const s = new ValueStruct(0x02000043);
      s.addStructElement(0x02000043, new ValueByteArray(new Uint8Array(bytes)));
      t.processReadResult(s, 0n);
      expect(t.valueNanosecond).toBe(755616051);
      expect(t.toISOString()).toBe("2026-11-21T10:14:43.755616051Z"); // Rome is UTC+1 in winter
      t.value = new Date(2026, 6, 15, 11, 14, 43);
      t.valueNanosecond = 5;
      expect(t.toISOString()).toBe("2026-07-15T09:14:43.000000005Z"); // and UTC+2 in summer
    });
  });

  it("DTL from ISO text in UTC", () => {
    inTimeZone("Europe/Rome", () => {
      const t = new PlcTagDTL("t", addr(), dt);
      t.fromISOString("2026-11-21T10:14:43.755616051Z");
      expect(t.toISOString()).toBe("2026-11-21T10:14:43.755616051Z");
      // the PLC gets the digits of Rome: 11:14:43 and 755616051 ns, and the weekday (7 = Saturday)
      const bytes = (t.getWriteValue() as any).getStructElement(0x02000043).getValue();
      expect(Array.from(bytes)).toEqual([0x07, 0xea, 11, 21, 7, 11, 14, 43, 0x2d, 0x09, 0xc9, 0x33]);
      t.fromISOString("2026-07-15T09:14:43.5Z"); // fewer decimals
      expect([t.value.getHours(), t.valueNanosecond]).toEqual([11, 500000000]);
      t.fromISOString("2026-07-15T09:14:43Z"); // no decimals
      expect(t.valueNanosecond).toBe(0);
    });
  });

  it("DTL refuses text that is not a valid UTC time in its range", () => {
    const t = new PlcTagDTL("t", addr(), dt);
    const texts = [
      "abc", "2026-11-21 10:14:43Z", "2026-11-21T10:14:43", "2026-11-21T10:14:43+01:00", "2026-11-21T10:14:43.1234567890Z",
      "2026-02-30T10:00:00Z", "2026-11-21T24:00:00Z", "1969-12-31T00:00:00Z", "2262-04-13T00:00:00Z",
    ];
    for (const text of texts) {
      expect(() => t.fromISOString(text)).toThrow(RangeError);
    }
  });

  it("DTL in a time zone", () => {
    inTimeZone("Europe/Rome", () => {
      const t = new PlcTagDTL("t", addr(), dt);
      // DTL#2026-03-29-02:30:00.000000005: an hour that does not exist in Rome, but does in UTC
      const s = new ValueStruct(0x02000043);
      s.addStructElement(0x02000043, new ValueByteArray(new Uint8Array([0x07, 0xea, 3, 29, 1, 2, 30, 0, 0, 0, 0, 5])));
      t.processReadResult(s, 0n);
      expect(t.toISOString("UTC")).toBe("2026-03-29T02:30:00.000000005Z"); // the digits do not move
      expect(t.toISOString("America/New_York")).toBe("2026-03-29T06:30:00.000000005Z"); // UTC-4 in summer
      // the same instant gives the digits of each time zone, and the weekday of those digits
      const bytes = () => Array.from((t.getWriteValue() as any).getStructElement(0x02000043).getValue());
      t.fromISOString("2026-11-21T23:30:00.5Z", "UTC");
      expect(bytes()).toEqual([0x07, 0xea, 11, 21, 7, 23, 30, 0, 0x1d, 0xcd, 0x65, 0x00]); // Saturday 23:30
      t.fromISOString("2026-11-21T23:30:00.5Z", "Europe/Rome");
      expect(bytes()).toEqual([0x07, 0xea, 11, 22, 1, 0, 30, 0, 0x1d, 0xcd, 0x65, 0x00]); // Sunday 00:30
      // the range is checked on the digits: 1970-01-01 00:00 in Rome is still 1969 in UTC
      t.fromISOString("1969-12-31T23:00:00Z", "Europe/Rome");
      expect(() => t.fromISOString("1969-12-31T23:00:00Z", "UTC")).toThrow(RangeError);
    });
  });

  it("DTL rejects a struct with the wrong id", () => {
    const t = new PlcTagDTL("t", addr(), dt);
    const s = new ValueStruct(0x02000044);
    s.addStructElement(0x02000044, new ValueByteArray(new Uint8Array(12)));
    t.processReadResult(s, 0n);
    expect(t.quality).toBe(PlcTagQC.TAG_QUALITY_BAD);
  });

  it("LDT as ISO text in UTC, and back", () => {
    inTimeZone("Europe/Rome", () => {
      const t = new PlcTagLDT("t", addr(), dt);
      // LDT#2026-11-21-11:14:43.755616051 as the PLC sends it: the digits in ns since 1970-01-01, without time zone
      const plc = BigInt(Date.UTC(2026, 10, 21, 11, 14, 43) / 1000) * 1000000000n + 755616051n;
      t.value = plc;
      expect(t.toISOString()).toBe("2026-11-21T10:14:43.755616051Z"); // Rome is UTC+1 in winter
      t.fromISOString("2026-07-15T09:14:43.000000005Z"); // and UTC+2 in summer: the PLC gets 11:14:43
      expect(t.value).toBe(BigInt(Date.UTC(2026, 6, 15, 11, 14, 43) / 1000) * 1000000000n + 5n);
      t.fromISOString("2026-11-21T10:14:43.755616051Z");
      expect(t.value).toBe(plc);
    });
  });

  it("LDT refuses text that is not a valid UTC time in its range", () => {
    inTimeZone("Europe/Rome", () => {
      const t = new PlcTagLDT("t", addr(), dt);
      t.fromISOString("1969-12-31T23:00:00Z"); // 1970-01-01 00:00 in Rome: the first LDT
      expect(t.value).toBe(0n);
      t.fromISOString("2262-04-11T21:47:16.854775807Z"); // 23:47:16.854775807 in Rome (summer): the last LDT
      expect(t.value).toBe(9223372036854775807n);
      for (const text of ["abc", "2026-02-30T10:00:00Z", "1969-12-31T22:59:59Z", "2262-04-11T21:47:16.854775808Z"]) {
        expect(() => t.fromISOString(text)).toThrow(RangeError);
      }
    });
  });

  it("LDT in a time zone", () => {
    inTimeZone("Europe/Rome", () => {
      const t = new PlcTagLDT("t", addr(), dt);
      // LDT#2026-03-29-02:30:00.000000005: an hour that does not exist in Rome, but does in UTC
      const plc = BigInt(Date.UTC(2026, 2, 29, 2, 30) / 1000) * 1000000000n + 5n;
      t.value = plc;
      expect(t.toISOString("UTC")).toBe("2026-03-29T02:30:00.000000005Z"); // the digits do not move
      expect(t.toISOString("America/New_York")).toBe("2026-03-29T06:30:00.000000005Z"); // UTC-4 in summer
      // and back: the same digits
      t.fromISOString("2026-03-29T02:30:00.000000005Z", "UTC");
      expect(t.value).toBe(plc);
      t.fromISOString("2026-03-29T06:30:00.000000005Z", "America/New_York");
      expect(t.value).toBe(plc);
      // the range is checked on the digits: 1970-01-01 00:00 in Rome is still 1969 in UTC
      t.fromISOString("1969-12-31T23:00:00Z", "Europe/Rome");
      expect(t.value).toBe(0n);
      expect(() => t.fromISOString("1969-12-31T23:00:00Z", "UTC")).toThrow(RangeError);
    });
  });
});

describe("Strings", () => {
  it("String", () => {
    const max = 254;
    let smax = "";
    for (let i = 0, c = 32; i < max; i++, c = c + 1 > 126 ? 32 : c + 1) smax += String.fromCharCode(c);
    for (const s of ["", "Hello", "This is a test!", "Motörhead", "abcdefghijklmnopqrstuvwxyz1234567890", smax]) {
      const src = new PlcTagString("t", addr(), dt, max);
      src.value = s;
      const w = src.getWriteValue() as ValueUSIntArray;
      expect(w.getValue().length).toBe(max + 2);
      expect(w.getValue()[0]).toBe(max);
      expect(w.getValue()[1]).toBe(s.length);
      expect(roundTrip(src, new PlcTagString("t", addr(), dt, max)).value).toBe(s);
    }
    expect(() => (new PlcTagString("t", addr(), dt, 10).value = "12345678901")).toThrow(RangeError);
  });

  it("String latin1 byte for 'ö'", () => {
    const t = new PlcTagString("t", addr(), dt, 10);
    t.value = "ö";
    expect(t.getWriteValue().constructor).toBe(ValueUSIntArray);
    expect((t.getWriteValue() as ValueUSIntArray).getValue()[2]).toBe(0xf6);
  });

  it("WString", () => {
    let smax = "";
    for (let i = 0, c = 32; i < 254; i++, c = c + 1 > 126 ? 32 : c + 1) smax += String.fromCharCode(c);
    for (const s of ["", "Hello", "Motörhead", "Test Greek ΣΛΔ end.", smax]) {
      const src = new PlcTagWString("t", addr(), dt, 254);
      src.value = s;
      const w = src.getWriteValue() as ValueUIntArray;
      expect(w.getValue()[0]).toBe(254);
      expect(w.getValue()[1]).toBe(s.length);
      expect(roundTrip(src, new PlcTagWString("t", addr(), dt, 254)).value).toBe(s);
    }
  });
});

describe("Pointer / Any", () => {
  it("Pointer", () => {
    for (const b of [[0x04, 0xd2, 0x84, 0x06, 0xee, 0xaa], [0xff, 0xff, 0x84, 0x01, 0x81, 0xcc]]) {
      const src = new PlcTagPointer("t", addr(), dt);
      src.value = new Uint8Array(b);
      expect(Array.from(roundTrip(src, new PlcTagPointer("t", addr(), dt)).value)).toEqual(b);
    }
    const t = new PlcTagPointer("t", addr(), dt);
    t.value = new Uint8Array([0x04, 0xd2, 0x84, 0x06, 0xee, 0xaa]);
    expect(t.toString()).toContain("DB=1234 Area=0x84 Byte=56789 Bit=2");
  });

  it("Any", () => {
    for (const b of [[0x10, 0x02, 0x00, 0x7b, 0x04, 0xd2, 0x84, 0x06, 0xee, 0xaa], [0x10, 0x02, 0x02, 0xa6, 0xff, 0xff, 0x84, 0x01, 0x81, 0xcc]]) {
      const src = new PlcTagAny("t", addr(), dt);
      src.value = new Uint8Array(b);
      expect(Array.from(roundTrip(src, new PlcTagAny("t", addr(), dt)).value)).toEqual(b);
    }
    const t = new PlcTagAny("t", addr(), dt);
    t.value = new Uint8Array([0x10, 0x02, 0x00, 0x7b, 0x04, 0xd2, 0x84, 0x06, 0xee, 0xaa]);
    expect(t.toString()).toContain("Factor=123 DB=1234 Area=0x84 Byte=56789 Bit=2");
  });
});

describe("Array PlcTags", () => {
  it("numeric / bool arrays", () => {
    const check = <T extends PlcTag>(mk: () => T & { value: any }, v: any): void => {
      const src = mk();
      src.value = v;
      const back = roundTrip(src, mk()).value;
      expect(Array.from(back)).toEqual(Array.from(v));
    };
    check(() => new PlcTagBoolArray("t", addr(), dt), [true, false, true, true, false, false, true, false, true]);
    check(() => new PlcTagByteArray("t", addr(), dt), new Uint8Array([0, 1, 0x55, 0xaa, 0xff]));
    check(() => new PlcTagWordArray("t", addr(), dt), [0, 1, 0xa5a5, 0xffff]);
    check(() => new PlcTagIntArray("t", addr(), dt), [-32768, -1, 0, 32767]);
    check(() => new PlcTagDWordArray("t", addr(), dt), [0, 1, 0xa5a5a5a5, 0xffffffff]);
    check(() => new PlcTagDIntArray("t", addr(), dt), [-2147483648, -1, 0, 2147483647]);
    check(() => new PlcTagRealArray("t", addr(), dt), [-1234.5, 0, 0.125, Infinity]);
    check(() => new PlcTagUSIntArray("t", addr(), dt), new Uint8Array([0, 1, 255]));
    check(() => new PlcTagUIntArray("t", addr(), dt), [0, 1, 65535]);
    check(() => new PlcTagUDIntArray("t", addr(), dt), [0, 1, 4294967295]);
    check(() => new PlcTagSIntArray("t", addr(), dt), [-128, 0, 127]);
  });

  it("DateAndTime array (multiple elements)", () => {
    const v = [new Date(1990, 0, 1), new Date(2023, 11, 23, 1, 2, 3, 123), new Date(2089, 11, 31, 23, 59, 59, 999)];
    const src = new PlcTagDateAndTimeArray("t", addr(), dt);
    src.value = v;
    const dst = roundTrip(src, new PlcTagDateAndTimeArray("t", addr(), dt));
    expect(dst.value.map((d) => d.getTime())).toEqual(v.map((d) => d.getTime()));
    // the weekday in the low nibble of the last byte of each DT (1 = Sunday): Monday, Saturday, Saturday
    const bytes = (src.getWriteValue() as ValueUSIntArray).getValue();
    expect([bytes[7] & 0x0f, bytes[15] & 0x0f, bytes[23] & 0x0f]).toEqual([2, 7, 7]);
  });

  it("DateAndTime array in a time zone", () => {
    inTimeZone("Europe/Rome", () => {
      const t = new PlcTagDateAndTimeArray("t", addr(), dt);
      // two DTs as the PLC sends them: 2026-11-21 21:03:10.344 and 2026-03-29 02:30, an hour that Rome skips
      const plc = [0x26, 0x11, 0x21, 0x21, 0x03, 0x10, 0x34, 0x47, 0x26, 0x03, 0x29, 0x02, 0x30, 0x00, 0x00, 0x01];
      t.processReadResult(new ValueUSIntArray(new Uint8Array(plc)), 0n);
      expect(t.toISOStrings("UTC")).toEqual(["2026-11-21T21:03:10.344Z", "2026-03-29T02:30:00.000Z"]);
      expect(t.toISOStrings("Europe/Rome")[0]).toBe("2026-11-21T20:03:10.344Z");
      // written back, the digits do not move
      expect(Array.from((t.getWriteValue() as ValueUSIntArray).getValue())).toEqual(plc);
    });
  });

  it("String array", () => {
    const v = ["Hello", "", "Motörhead", "x".repeat(20)];
    const src = new PlcTagStringArray("t", addr(), dt, 20);
    src.value = v;
    const w = src.getWriteValue() as ValueUSIntArray;
    expect(w.getValue().length).toBe(v.length * 22);
    expect(roundTrip(src, new PlcTagStringArray("t", addr(), dt, 20)).value).toEqual(v);
    expect(() => (src.value = ["x".repeat(21)])).toThrow(RangeError);
  });
});

describe("tagFactory", () => {
  it("creates tags for the known soft datatypes", () => {
    const t = tagFactory("n", addr(), Softdatatype.S7COMMP_SOFTDATATYPE_INT);
    expect(t).toBeInstanceOf(PlcTagInt);
    expect(tagFactory("n", addr(), Softdatatype.S7COMMP_SOFTDATATYPE_DTL)).toBeInstanceOf(PlcTagDTL);
    expect(tagFactory("n", addr(), Softdatatype.S7COMMP_SOFTDATATYPE_LWORD)).toBeInstanceOf(PlcTagLWord);
  });
});

