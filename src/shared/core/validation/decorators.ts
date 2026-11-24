import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

// Valida o campo somente quando ele foi enviado. Diferente de @IsOptional, um null explícito continua sendo validado (e rejeitado).
export const ValidateIfProvided = () => ValidateIf((_: unknown, value: unknown) => value !== undefined);

export const Trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);
