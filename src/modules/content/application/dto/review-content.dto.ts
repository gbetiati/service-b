import { IsBoolean, IsInt, Min } from 'class-validator';

// Revisão humana: a revisão do conteúdo que a pessoa viu e a decisão (aprovar ou reprovar).
export class ReviewContentDto {
  @IsInt() @Min(1) revision!: number;
  @IsBoolean() approved!: boolean;
}
