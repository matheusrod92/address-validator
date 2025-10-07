import type { StandardizedAddress, ValidationStatus } from "@/api/address/addressModel";
import { env } from "@/common/utils/envConfig";
import { logger } from "@/server";

interface SmartyAnalysis {
	dpv_match_code: string;
	dpv_footnotes: string;
	dpv_cmra: string;
	dpv_vacant: string;
	active: string;
	footnotes?: string;
	enhanced_match?: string;
}

interface SmartyMetadata {
	record_type: string;
	zip_type: string;
	county_fips: string;
	county_name: string;
	carrier_route: string;
	congressional_district: string;
	rdi: string;
	elot_sequence: string;
	elot_sort: string;
	latitude: number;
	longitude: number;
	precision: string;
	time_zone: string;
	utc_offset: number;
	dst: boolean;
}

interface SmartyComponents {
	primary_number?: string;
	street_name?: string;
	street_predirection?: string;
	street_postdirection?: string;
	street_suffix?: string;
	secondary_number?: string;
	secondary_designator?: string;
	city_name?: string;
	state_abbreviation?: string;
	zipcode?: string;
	plus4_code?: string;
}

interface SmartyCandidate {
	delivery_line_1: string;
	last_line: string;
	components: SmartyComponents;
	metadata: SmartyMetadata;
	analysis: SmartyAnalysis;
}

export type SmartyValidationResponse = SmartyCandidate[];

export interface SmartyServiceResult {
	standardized: StandardizedAddress;
	status: ValidationStatus;
	corrections: string[];
	warnings: string[];
}

export class SmartyService {
	private readonly authId: string;
	private readonly authToken: string;
	private readonly apiUrl = "https://us-street.api.smartystreets.com/street-address";

	constructor() {
		this.authId = env.SMARTY_AUTH_ID;
		this.authToken = env.SMARTY_AUTH_TOKEN;
	}

	async validateAddress(address: string): Promise<SmartyServiceResult> {
		if (process.env.NODE_ENV !== "test" && (this.authId.startsWith("test-") || this.authToken.startsWith("test-"))) {
			throw new Error(
				"Smarty API credentials not configured properly. Please set SMARTY_AUTH_ID and SMARTY_AUTH_TOKEN environment variables.",
			);
		}

		try {
			const url = new URL(this.apiUrl);
			url.searchParams.append("auth-id", this.authId);
			url.searchParams.append("auth-token", this.authToken);
			url.searchParams.append("street", address);
			url.searchParams.append("match", "invalid");

			const response = await fetch(url.toString(), {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Smarty API error: ${response.status} ${response.statusText} - ${errorText}`);
			}

			const data = (await response.json()) as SmartyValidationResponse;

			if (!data || data.length === 0) {
				return {
					standardized: {},
					status: "UNVERIFIABLE",
					corrections: [],
					warnings: ["No matching address found"],
				};
			}

			return this.parseSmartyResponse(data[0], address);
		} catch (error) {
			logger.error(`Smarty service error: ${(error as Error).message}`);
			throw error;
		}
	}

	private parseSmartyResponse(candidate: SmartyCandidate, originalAddress: string): SmartyServiceResult {
		const corrections: string[] = [];
		const warnings: string[] = [];
		let status: ValidationStatus = "VALID";
		const { analysis, metadata, components } = candidate;

		if (analysis.dpv_match_code === "N") {
			status = "UNVERIFIABLE";
			warnings.push("Address could not be confirmed by USPS");
		} else if (analysis.dpv_match_code === "S" || analysis.dpv_match_code === "D") {
			status = "CORRECTED";
			warnings.push("Address is missing secondary information (apt, suite, etc.)");
		}

		if (analysis.enhanced_match) {
			status = "CORRECTED";
			corrections.push("Address was enhanced or corrected");
		}

		const deliveryLine = candidate.delivery_line_1.toLowerCase();
		const inputLower = originalAddress.toLowerCase();
		if (!inputLower.includes(deliveryLine.substring(0, Math.min(20, deliveryLine.length)))) {
			if (status === "VALID") {
				status = "CORRECTED";
				corrections.push("Address format was standardized");
			}
		}

		if (analysis.dpv_vacant === "Y") {
			warnings.push("Address is marked as vacant");
		}

		if (metadata.record_type !== "S" && metadata.record_type !== "H") {
			warnings.push(`Address record type is ${metadata.record_type}`);
		}

		const standardized = this.extractStandardizedAddress(components);

		return {
			standardized,
			status,
			corrections,
			warnings,
		};
	}

	private extractStandardizedAddress(components: SmartyComponents): StandardizedAddress {
		const streetParts = [
			components.street_predirection,
			components.street_name,
			components.street_suffix,
			components.street_postdirection,
		].filter(Boolean);

		const street = streetParts.length > 0 ? streetParts.join(" ") : undefined;

		const zip =
			components.zipcode && components.plus4_code
				? `${components.zipcode}-${components.plus4_code}`
				: components.zipcode;

		return {
			number: components.primary_number,
			street,
			city: components.city_name,
			state: components.state_abbreviation,
			zip,
		};
	}
}

export const smartyService = new SmartyService();
