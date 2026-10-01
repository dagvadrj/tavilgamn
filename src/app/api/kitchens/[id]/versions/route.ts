import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const auth=await requireUser(request);if(auth.error)return auth.error;
  const {id}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return apiErrorResponse({error:"Загварын ID буруу байна."},{status:400,headers});
  const requested=request.nextUrl.searchParams.get('revision');
  if(requested!==null && (!/^[1-9]\d{0,8}$/.test(requested)))return apiErrorResponse({error:"Хувилбарын дугаар буруу байна."},{status:400,headers});
  const db=getSupabaseAdmin();
  const query=db.from('kitchen_garniture_versions').select(requested?'revision,name,design,created_at,thumbnail_url':'revision,name,created_at,thumbnail_url')
    .eq('user_id',auth.userId).eq('kitchen_id',id);
  if(requested){
    const {data,error}=await query.eq('revision',Number(requested)).maybeSingle();
    if(error)return apiErrorResponse({error:"Хувилбар ачаалагдсангүй."},{status:503,headers});
    if(!data)return apiErrorResponse({error:"Хувилбар олдсонгүй."},{status:404,headers});
    return NextResponse.json({version:data},{headers});
  }
  const before=request.nextUrl.searchParams.get('before');
  if(before!==null&&!/^[1-9]\d{0,8}$/.test(before))return apiErrorResponse({error:"Хуудасны дугаар буруу байна."},{status:400,headers});
  const {data,error}=await (before?query.lt('revision',Number(before)):query).order('revision',{ascending:false}).limit(30);
  return error?apiErrorResponse({error:"Хувилбарын түүх ачаалагдсангүй."},{status:503,headers}):NextResponse.json({versions:data},{headers});
}
