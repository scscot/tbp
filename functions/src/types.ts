export type ISO8601 = string;

export interface IssueReferralRequest {
  sponsorCode?: string;
  t?: string;
  source?: 'web_button' | 'web_button_no_sponsor' | 'app_clip' | 'magic_link';
}

export interface IssueReferralResponse {
  token: string;
  expiresAt: ISO8601;
}

export interface RedeemReferralRequest {
  token: string;
}

export type RedeemStatus = 'redeemed' | 'already_redeemed' | 'expired' | 'not_found';

export interface RedeemReferralResponse {
  status: RedeemStatus;
  sponsorCode?: string;
  t?: string;
}

export interface ClipHandoffCreateRequest {
  handoffId: string;
  ref?: string;
  t?: string;
  issuedAt?: number;
}

export interface ClipHandoffCreateResponse {
  handoffId: string;
  created: boolean;
  sponsor?: { firstName?: string; lastName?: string; bizOppName?: string };
}

export interface ClipHandoffClaimRequest {
  handoffId: string;
}

export interface ClipHandoffClaimResponse {
  found: boolean;
  claimed: boolean;
  ref?: string;
  t?: string;
}

export interface ResolveSponsorResponse {
  ref: string;
  sponsor?: { firstName?: string; lastName?: string; bizOppName?: string };
}
