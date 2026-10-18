export interface RentalTemplate {
 id:string; revision:string; propertyId:string; origin:string; required:boolean; blockAccess:boolean; currentVersion:string;
 versions:{id:string; required:boolean; blockAccess:boolean; title:string; state:string; text:string; at:string; by:string}[];
}
export interface RentalSignature {
 name:string; email:string; at:string; consent:string; method:string; userAgent?:string;
}
export interface RentalDocument {
 id:string; templateVersion:string; templateText:string; reservationTerms:string; title:string; state:string; text:string; sha256:string;
 at:string; by:string; reason:string; start:string; end:string; guestName:string;
 arrivalTime:string; departureTime:string; timeZone:string; signature?:RentalSignature;
}
export interface RentalAgreement {
 id:string; revision:string; propertyId:string; bookingId:string; required:boolean; blockAccess:boolean;
 token:string|null; origin:string; currentVersion:string; documents:RentalDocument[];
}
