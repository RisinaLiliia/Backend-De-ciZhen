import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class WorkspaceProfileCommonDto {
  @ApiProperty({ example: 'Liliia' })
  name: string;

  @ApiProperty({ example: 'liliia@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'Berlin', nullable: true })
  city: string | null;

  @ApiPropertyOptional({ example: '68163f3d8ff0c1a8f677a111', nullable: true })
  cityId: string | null;

  @ApiPropertyOptional({ example: '+49123456789', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/u1.png', nullable: true })
  avatarUrl: string | null;
}

export class WorkspaceProfileCustomerDto {
  @ApiPropertyOptional({ example: 'Ich beschreibe hier meine Anforderungen.', nullable: true })
  bio: string | null;
}

export class WorkspaceProfileProviderDto {
  @ApiPropertyOptional({ example: 'Anna Cleaner', nullable: true })
  displayName: string | null;

  @ApiPropertyOptional({ example: 'Ich arbeite sauber und pünktlich.', nullable: true })
  bio: string | null;

  @ApiPropertyOptional({ example: '68163f3d8ff0c1a8f677a111', nullable: true })
  cityId: string | null;

  @ApiPropertyOptional({ example: 'cleaning', nullable: true })
  selectedCategoryKey: string | null;

  @ApiPropertyOptional({ example: 'home_cleaning', nullable: true })
  selectedServiceKey: string | null;

  @ApiProperty({ example: ['home_cleaning'] })
  serviceKeys: string[];

  @ApiPropertyOptional({ example: 40, nullable: true })
  basePrice: number | null;

  @ApiPropertyOptional({ example: 'draft', nullable: true })
  status: 'draft' | 'active' | 'suspended' | null;

  @ApiProperty({ example: false })
  isBlocked: boolean;

  @ApiProperty({ example: false })
  isProfileComplete: boolean;
}

export class WorkspaceProfileResponseDto {
  @ApiProperty({ type: WorkspaceProfileCommonDto })
  common: WorkspaceProfileCommonDto;

  @ApiProperty({ type: WorkspaceProfileCustomerDto })
  customer: WorkspaceProfileCustomerDto;

  @ApiProperty({ type: WorkspaceProfileProviderDto })
  provider: WorkspaceProfileProviderDto;
}

export class SaveWorkspaceProfileDto {
  @ApiPropertyOptional({ example: 'Liliia' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'Berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: '+49123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^$|^[+0-9\s()-]{6,30}$/, { message: 'Invalid phone format' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Kurzprofil als Auftraggeber.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerBio?: string;

  @ApiPropertyOptional({ example: 'Anna Cleaner' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerDisplayName?: string;

  @ApiPropertyOptional({ example: 'Kurzprofil als Anbieter.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  providerBio?: string;

  @ApiPropertyOptional({ example: 'cleaning' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  providerCategoryKey?: string;

  @ApiPropertyOptional({ example: 'home_cleaning' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  providerServiceKey?: string;

  @ApiPropertyOptional({ example: '40' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  providerBasePrice?: string;
}

export class RegisterWorkspaceProfileDto extends SaveWorkspaceProfileDto {
  @ApiProperty({ example: 'Liliia' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  declare name: string;

  @ApiProperty({ example: 'provider', enum: ['provider', 'customer'] })
  @IsIn(['provider', 'customer'])
  viewerMode: 'provider' | 'customer';

  @ApiProperty({ example: 'liliia@example.com' })
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({ example: 'Password1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/[A-ZА-ЯЁ]/, { message: 'password must contain at least one uppercase letter' })
  @Matches(/[a-zа-яё]/, { message: 'password must contain at least one lowercase letter' })
  @Matches(/\d/, { message: 'password must contain at least one digit' })
  @Matches(/[^A-Za-zА-Яа-яЁё0-9]/, { message: 'password must contain at least one symbol' })
  password: string;

  @ApiProperty({ example: '68163f3d8ff0c1a8f677a111' })
  @IsString()
  @MaxLength(64)
  cityId: string;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  acceptPrivacyPolicy: boolean;
}
