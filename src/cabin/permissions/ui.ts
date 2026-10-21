import { h,hidden,form,field,select } from '../ui/shared'
import { roleActions,roleNames } from './policy'
export function grantFields(s:any,member?:any){
 const scope=member?.scope,role=scope?.pmsRole??member?.role
 const roles=Object.entries(roleNames).map(([id,name])=>`<option value="${h(id)}"${id===role?' selected':''}>${h(name)}</option>`).join('')
 const properties=s.properties.map((p:any)=>`<label class="check"><input type="checkbox" name="propertyIds" value="${h(p.id)}"${scope?.propertyIds.includes(p.id)||scope?.propertyIds.includes('*')?' checked':''}>${h(p.name)}</label>`).join('')
 const choices=[...new Set(Object.values(roleActions).flat())].sort()
 const actions=choices.map(action=>`<label class="check"><input type="checkbox" name="actions" value="${h(action)}"${scope?.actions.includes(action)||scope?.actions.includes('*')&&roleActions[(role??'manager') as keyof typeof roleActions]?.includes(action)?' checked':''}>${h(action)}</label>`).join('')
 return `<label>PMS role<select name="pmsRole" aria-label="PMS role" required><option value="">Choose…</option>${roles}</select></label><fieldset><legend>Property scope</legend>${properties||'<p>Add a property first.</p>'}</fieldset><details><summary>Action scope</summary><p>Select the actions this person needs. Actions outside the selected role are refused. Invitation and credentials remain with the installation owner.</p>${actions}</details>`
}
export function grantEditor(s:any,m:any){return `<p>Role: ${h(roleNames[m.scope?.pmsRole as keyof typeof roleNames]??m.role)}. Properties: ${h(m.scope?.propertyIds.includes('*')?'Whole portfolio':m.scope?.propertyIds.map((id:string)=>s.properties.find((p:any)=>p.id===id)?.name??id).join(', ')??'Existing assignments')}. Actions: ${h(m.scope?.actions.join(', ')??'Existing role')}.</p><details><summary>Edit access scope</summary>${form('member.save','people',hidden('id',m.id)+hidden('revision',m.revision)+field('name','Name','text',m.name)+field('email','Email','email',m.email)+hidden('active',String(m.active))+grantFields(s,m),'Save access scope')}</details>`}
