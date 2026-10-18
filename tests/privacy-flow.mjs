/** Exercise the same exact review and confirmation doors as the owner UI. */
export async function erase(h,input,cookie=h.owner){
 const review=await h.cmd('privacy.review',input,cookie)
 return h.cmd('privacy.erase',{...input,reviewId:review.reviewId},cookie)
}
