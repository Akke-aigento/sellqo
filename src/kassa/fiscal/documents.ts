// KASSA-0 — GraphQL-documenten voor de FDM (FDM-01, FDM-07).
// `footer` zit ALTIJD in de selectie (BasicSet changelog 1.7): hij moet op het kasticket.
import { MUTATION_INPUT } from './schema';
import type { AnyFiscalInput, Language, MutationName } from './types';

const MESSAGE = `{
      message
      locations { line column }
      extensions { category code data { name value } showPos }
    }`;

export const SIGN_RESULT_SELECTION = `{
    posId
    posFiscalTicketNo
    posDateTime
    terminalId
    deviceId
    eventOperation
    fdmRef { fdmId fdmDateTime eventLabel eventCounter totalCounter }
    fdmSwVersion
    digitalSignature
    shortSignature
    verificationUrl
    vatCalc { label rate taxableAmount vatAmount totalAmount outOfScope }
    bufferCapacityUsed
    warnings ${MESSAGE}
    informations ${MESSAGE}
    footer
  }`;

export function mutationDocument(name: MutationName): string {
  const input = MUTATION_INPUT[name];
  return `mutation SellQo_${name}($data: ${input}!, $training: Boolean! = false) {
  ${name}(data: $data, isTraining: $training) ${SIGN_RESULT_SELECTION}
}`;
}

export const STATUS_DOCUMENT = `query SellQo_status($language: Language! = EN) {
  status(language: $language) {
    device { fdmId fdmSwVersion fdmDateTime bufferCapacityUsed }
    initialized
    informations ${MESSAGE}
    warnings ${MESSAGE}
    errors ${MESSAGE}
  }
}`;

export interface GraphQLRequestBody {
  query: string;
  operationName: string;
  variables: Record<string, unknown>;
}

/** Het volledige HTTP-body voor één mutatie. Deterministisch: zelfde input = zelfde bytes (ID-11). */
export function mutationBody(name: MutationName, data: AnyFiscalInput, isTraining = false): GraphQLRequestBody {
  return { query: mutationDocument(name), operationName: `SellQo_${name}`, variables: { data, training: isTraining } };
}

export function statusBody(language: Language = 'EN'): GraphQLRequestBody {
  return { query: STATUS_DOCUMENT, operationName: 'SellQo_status', variables: { language } };
}
