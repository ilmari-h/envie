export interface EnvVar {
  name: string;
  value: string;
}

export const parseEnvContent = (content: string): EnvVar[] => {
  return content
    .split("\n")
    .filter(line => line.trim() && !line.startsWith("#"))
    .map(line => {
      const parts = line.split("=");
      const name = parts[0] || "";
      const value = parts.slice(1).join("=") || "";
      return { name: name.trim(), value: value.trim() };
    });
};

