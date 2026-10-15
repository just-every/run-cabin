export class ImportError extends Error { constructor(public code:string,public status=400,message=code){super(message)} }
export function requiredText(value:unknown,label:string){if(typeof value!=='string'||!value.trim())throw new ImportError('invalid_'+label);return value.trim()}
