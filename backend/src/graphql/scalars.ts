import { GraphQLScalarType, Kind } from "graphql";

export const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO-8601 DateTime string",
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return new Date(value as any).toISOString();
  },
  parseValue(value) {
    if (typeof value !== "string") throw new Error("DateTime must be a string");
    return new Date(value);
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) throw new Error("DateTime must be a string");
    return new Date(ast.value);
  }
});

export const DecimalScalar = new GraphQLScalarType({
  name: "Decimal",
  description: "Decimal as string",
  serialize(value) {
    return typeof value === "string" ? value : String(value);
  },
  parseValue(value) {
    if (typeof value !== "string" && typeof value !== "number") throw new Error("Decimal must be string/number");
    return String(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT) return ast.value;
    throw new Error("Decimal must be string/number");
  }
});

