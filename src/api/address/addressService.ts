import type { AddressValidationResponse, Provider } from "@/api/address/addressModel";
import { googleService } from "@/common/services/googleService";
import { smartyService } from "@/common/services/smartyService";
import { logger } from "@/server";

export class AddressService {
	/**
	 * Validates an address using the specified provider or automatic fallback
	 * @param address - The address string to validate
	 * @param provider - Optional provider preference ("google" | "smarty")
	 * @returns AddressValidationResponse
	 * @throws Error if validation fails
	 */
	async validateAddress(address: string, provider?: Provider): Promise<AddressValidationResponse> {
		if (provider === "google") {
			return await this.validateWithGoogle(address);
		}

		if (provider === "smarty") {
			return await this.validateWithSmarty(address);
		}

		return await this.validateWithFallback(address);
	}

	private async validateWithFallback(address: string): Promise<AddressValidationResponse> {
		try {
			const googleResponse = await this.validateWithGoogle(address);

			if (googleResponse.status === "UNVERIFIABLE") {
				logger.info("Google returned UNVERIFIABLE, attempting Smarty fallback");
				try {
					return await this.validateWithSmarty(address);
				} catch (smartyError) {
					logger.warn(`Smarty fallback failed: ${(smartyError as Error).message}`);
					return googleResponse;
				}
			}

			return googleResponse;
		} catch (googleError) {
			logger.warn(`Google service failed, attempting Smarty fallback: ${(googleError as Error).message}`);
			try {
				return await this.validateWithSmarty(address);
			} catch (smartyError) {
				throw new Error(
					`Both providers failed - Google: ${(googleError as Error).message}, Smarty: ${(smartyError as Error).message}`,
				);
			}
		}
	}

	private async validateWithGoogle(address: string): Promise<AddressValidationResponse> {
		const result = await googleService.validateAddress(address);

		return {
			input: address,
			standardized: result.standardized,
			status: result.status,
			corrections: result.corrections,
			provider: "google",
			warnings: result.warnings,
		};
	}

	private async validateWithSmarty(address: string): Promise<AddressValidationResponse> {
		const result = await smartyService.validateAddress(address);

		return {
			input: address,
			standardized: result.standardized,
			status: result.status,
			corrections: result.corrections,
			provider: "smarty",
			warnings: result.warnings,
		};
	}
}

export const addressService = new AddressService();
