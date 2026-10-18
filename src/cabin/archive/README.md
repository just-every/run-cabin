The portable record transformation is shared by the public rer adapter and the
hosted backup command. It is pure and idempotent; staged validation runs before
an import writes product data.

inter-font.json is the existing public/fonts/inter/inter-latin-wght-normal.woff2
font converted to a static weight-400 TrueType font using FontTools and stored
as base64 for Worker embedding. It remains under the SIL Open Font License in
public/fonts/inter/LICENSE.txt. The PDF renderer embeds a subset and makes no
font-provider request.
