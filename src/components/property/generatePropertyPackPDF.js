import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generatePropertyPackPDF = async (supabase, unitId, unit, project, currentUser, brokerInfo = {}) => {
  try {
    if (!unit || !project) throw new Error('Unit or project data required');
    
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '210mm';
    container.style.height = '297mm';
    container.style.backgroundColor = '#fff';
    container.style.zIndex = '-1000';

    const amenities = project.amenities || [];
    const photos = project.photo_gallery_urls || [];
    const bedLabel = !unit.bedrooms ? 'Studio' : (unit.bedrooms ? `${unit.bedrooms}BR` : 'N/A');
    
    container.innerHTML = `<div id="property-pack-pdf" style="width:210mm;height:297mm;margin:0;padding:20mm;fontFamily:'Segoe UI','Helvetica Neue',sans-serif;backgroundColor:#fff;color:#0F2540;lineHeight:1.6;fontSize:14px;boxSizing:border-box">
      <div style="display:flex;justifyContent:space-between;alignItems:center;marginBottom:20px;paddingBottom:15px;borderBottom:2px solid #C9A84C">
        <div><div style="fontSize:24px;fontWeight:700;color:#0F2540">${project.name || 'Property Detail Pack'}</div><div style="fontSize:13px;color:#64748B;marginTop:4px">${unit.unit_ref || 'Unit'} • ${bedLabel} • ${unit.size_sqft ? unit.size_sqft + ' sqft' : 'N/A'}</div></div>
        <div style="textAlign:right;fontSize:11px;color:#64748B"><div>${new Date().toLocaleDateString()}</div><div style="marginTop:4px">PropCRM</div></div>
      </div>
      ${project.hero_image_url ? `<div style="marginBottom:20px"><img src="${project.hero_image_url}" style="width:100%;maxHeight:150px;objectFit:cover;borderRadius:8px" /></div>` : ''}
      <div style="display:grid;gridTemplateColumns:1fr 1fr;gap:15px;marginBottom:20px;backgroundColor:#F8FAFC;padding:15px;borderRadius:8px;border:1px solid #E2E8F0">
        <div><div style="fontSize:10px;fontWeight:700;color:#64748B;textTransform:uppercase">Type</div><div style="fontSize:13px;fontWeight:600;color:#0F2540;marginTop:4px">${unit.sub_type || 'Residential'}</div></div>
        <div><div style="fontSize:10px;fontWeight:700;color:#64748B;textTransform:uppercase">Bedrooms</div><div style="fontSize:13px;fontWeight:600;color:#0F2540;marginTop:4px">${bedLabel}</div></div>
        <div><div style="fontSize:10px;fontWeight:700;color:#64748B;textTransform:uppercase">Size</div><div style="fontSize:13px;fontWeight:600;color:#0F2540;marginTop:4px">${unit.size_sqft ? unit.size_sqft + ' sqft' : 'N/A'}</div></div>
        <div><div style="fontSize:10px;fontWeight:700;color:#64748B;textTransform:uppercase">View</div><div style="fontSize:13px;fontWeight:600;color:#0F2540;marginTop:4px">${unit.view || 'N/A'}</div></div>
        <div style="gridColumn:1/-1"><div style="fontSize:10px;fontWeight:700;color:#64748B;textTransform:uppercase">Price</div><div style="fontSize:15px;fontWeight:700;color:#1A5FA8;marginTop:4px">AED ${Number(unit.asking_price || 0).toLocaleString()}</div></div>
      </div>
      ${amenities.length > 0 ? `<div style="marginBottom:20px"><div style="fontSize:12px;fontWeight:700;color:#0F2540;textTransform:uppercase;marginBottom:12px">Community Amenities</div><div style="display:grid;gridTemplateColumns:repeat(3,1fr);gap:10px">${amenities.slice(0, 9).map((a, i) => `<div style="display:flex;alignItems:center;gap:8px;fontSize:12px;padding:8px;backgroundColor:#F0F9FF;borderRadius:6px;border:1px solid #BAE6FD"><span>📍</span><span style="color:#0C4A6E;fontWeight:600">${a}</span></div>`).join('')}</div></div>` : ''}
      ${photos.length > 0 ? `<div style="marginBottom:20px"><div style="fontSize:12px;fontWeight:700;color:#0F2540;textTransform:uppercase;marginBottom:12px">Community Photos</div><div style="display:grid;gridTemplateColumns:repeat(3,1fr);gap:10px">${photos.slice(0, 3).map((p, i) => `<img src="${p}" style="width:100%;height:80px;objectFit:cover;borderRadius:6px;border:1px solid #E2E8F0" />`).join('')}</div></div>` : ''}
      <div style="backgroundColor:#F8FAFC;padding:12px;borderRadius:8px;border:1px solid #E2E8F0;marginBottom:20px"><div style="fontSize:11px;fontWeight:700;color:#64748B;textTransform:uppercase;marginBottom:10px">Documents & Links</div><div style="display:flex;flexDirection:column;gap:8px;fontSize:11px">${project.master_plan_url ? '<div>📋 <strong>Master Plan:</strong> Available</div>' : ''}${project.brochure_url ? '<div>📄 <strong>Brochure:</strong> Available</div>' : ''}${project.video_url ? '<div>🎥 <strong>Video Tour:</strong> Available</div>' : ''}</div></div>
      <div style="marginTop:25px;paddingTop:15px;borderTop:1px solid #E2E8F0;fontSize:11px;color:#64748B"><div style="fontWeight:700;color:#0F2540;marginBottom:8px">Your Broker</div><div>${brokerInfo.name || currentUser?.full_name || 'PropCRM Broker'}</div><div>📱 ${brokerInfo.phone || currentUser?.phone || '+971 50 000 0000'}</div><div>📧 ${brokerInfo.email || currentUser?.email || 'broker@propcrm.ae'}</div><div style="marginTop:12px;fontSize:10px;color:#94A3B8">Generated by PropCRM • ${new Date().toLocaleDateString()}</div></div>
    </div>`;

    document.body.appendChild(container);
    
    const canvas = await html2canvas(container, {scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: true, imageTimeout: 5000});
    
    const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
    const imgData = canvas.toDataURL('image/png');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.setProperties({title: `${unit.unit_ref || 'Property'} - ${project.name || 'Detail Pack'}`, subject: `Property Detail Pack for ${unit.unit_ref}`, author: 'PropCRM', keywords: 'property, detail, pack, real estate'});

    document.body.removeChild(container);

    return pdf.output('blob');
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  }
};

export const uploadPropertyPackPDF = async (supabase, blob, companyId, unitId, unitRef) => {
  try {
    const fileName = `${unitRef || unitId}-${Date.now()}.pdf`;
    const filePath = `property-packs/${companyId}/${fileName}`;

    const { data, error } = await supabase.storage.from('propcrm-files').upload(filePath, blob, {contentType: 'application/pdf', upsert: false});
    if (error) throw error;

    const { data: signedUrl, error: signError } = await supabase.storage.from('propcrm-files').createSignedUrl(filePath, 86400);
    if (signError) throw signError;

    return {filePath, fileName, url: signedUrl.signedUrl, publicUrl: signedUrl.signedUrl};
  } catch (error) {
    console.error('PDF upload failed:', error);
    throw error;
  }
};
