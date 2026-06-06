import { useState } from "react";

export default function useOnce<T>(fn: () => T): T {
  return useState(fn)[0];
}
