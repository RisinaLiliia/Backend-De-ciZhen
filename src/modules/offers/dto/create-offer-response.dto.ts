import { ApiProperty } from '@nestjs/swagger';
import { OfferDto } from './offer.dto';
import { ProviderProfileDto } from '../../providers/dto/provider-profile.dto';

export class CreateOfferResponseDto {
  @ApiProperty({ type: OfferDto })
  offer: OfferDto;

  @ApiProperty({ type: ProviderProfileDto })
  providerProfile: ProviderProfileDto;
}
