import { Link } from 'react-router';
import { Briefcase, ChevronLeft, Linkedin, Facebook, Mail } from 'lucide-react';
import { useBranding } from '../../hooks/useBranding';
import { resolveAssetUrl } from '../../services/api';

export function DataProcessingAgreement() {
  const branding = useBranding();
  const logoSrc = branding.logoUrl ? resolveAssetUrl(branding.logoUrl) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header — same layout as the other public pages */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2563EB] rounded-lg flex items-center justify-center overflow-hidden">
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Briefcase className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight">{branding.companyName}</p>
              <p className="text-xs text-gray-500">Data Processing Agreement</p>
            </div>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 py-12 px-6">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border p-8 md:p-10 font-serif text-sm leading-relaxed text-gray-900">
          <h1 className="text-xl font-bold text-center mb-2">INFORMATION About PROCESSING PERSONAL DATA</h1>
          <h2 className="text-lg font-bold text-center mb-8">In FRAMES OF LABOR LAW REGULATIONS</h2>

          <p className="mb-1">Employer:</p>
          <p className="font-bold">Tempworks s.r.o</p>
          <p className="font-bold">Röntgenova 3751/28</p>
          <p className="font-bold">851 01 Petržalka</p>
          <p className="font-bold">Bratislava</p>
          <p className="font-bold mb-4">Company ID: 53521226</p>
          <p className="font-bold mb-8">Municipal Court Bratislava III</p>

          <h3 className="font-bold mb-3">1. Introduction</h3>
          <p className="mb-3 ml-4">1.1. This document was prepared by the employer in order to fulfill its obligations to inform employees, as data subjects, about the circumstances of the processing of personal data within the framework of their employment relationship with the employer. in meaning Art. 13 and 14 Regulations European Parliament and the Council (EU) No. 2016/679 about protection natural persons in connection with the processing of personal data and the free movement of this data and repeal of Directive 95/46/EC (the so-called General Data Protection Regulation (<strong>GDPR</strong>), hereinafter referred to as the <strong>("Regulation").</strong></p>
          <p className="mb-6 ml-4">1.2. This document applies to all employees in an employment relationship with the employer, including those who have concluded any agreements with the employer outside of the employment relationship. Everyone employees are obligatory with this document to acquaint and this fact confirm by signing a copy of the document. The employer is obliged to ensure that all employees are familiar with the contents of the document and that they had additional information available to them necessary for a full understanding of it.</p>

          <h3 className="font-bold mb-3">2. Processing personal data on basis law</h3>
          <p className="mb-3 ml-4">2.1. Employer is authorized to process personal data employee and his family members in the future puffing range:</p>
          <div className="ml-8 mb-3">
            <p className="mb-1">2.1.1. For the employee:</p>
            <ul className="list-[lower-alpha] ml-6 space-y-0.5">
              <li>name, surname, title</li>
              <li>date and place birth, ID number</li>
              <li>place permanent residence possibly transitional residence, possibly delivery address</li>
              <li>nationality</li>
              <li>state citizenship</li>
              <li>family status</li>
              <li>private email, private phone number</li>
              <li>achieved education</li>
              <li>data about paid wages</li>
              <li>health insurance company</li>
              <li>family status</li>
              <li>number children</li>
              <li>health disadvantage and kind received pension</li>
              <li>data about health capabilities employee on performance kind work agreed upon employment contract including records of work-related accidents</li>
            </ul>
          </div>
          <div className="ml-8 mb-4">
            <p className="mb-1">2.1.2. For family members employee:</p>
            <ul className="list-[lower-alpha] ml-6 space-y-0.5">
              <li>surname, name and native number husband/wife and his/her permanent residence</li>
              <li>name, address employer husband/wife</li>
              <li>name, surname, native number child, date birth</li>
            </ul>
          </div>
          <p className="mb-3 ml-4">2.2. The employee acknowledges that in order to fulfill the obligation in the field of occupational medical care, the employer processes information about his health condition to the extent of assessing his health fitness to perform work under the employment contract. This information constitutes special category personal data in pursuant to Article 9 of the Regulation, and the employee's consent is not required for their processing for the stated purpose.</p>
          <p className="mb-3 ml-4">2.3. The employee further acknowledges that in order to fulfill the obligation to record working hours for the employee under the Labor Code, the employer may process the individual identifier of the employee's attendance record. chip, which is (can to be) employee provided and which serves on recording arrival and employee departure.</p>
          <p className="mb-3 ml-4">2.4. The employee acknowledges that the processing of personal data pursuant to Article 2 of this document is necessary to fulfill the legal obligations that apply to the employer, as the controller of personal data (in particular, under the Labor Code and related regulations, under the legislation on social and health insurance and the legislation on income tax). income). The employee's consent is not required for this processing. The provision of this personal data to employees is mandatory, and without this data cannot employer to fulfill your legal obligations according to special legal regulations, and cannot agree on or maintain an employment relationship with the employee.</p>
          <p className="mb-3 ml-4">2.5. Processed personal data are obtained directly from employee. Personal data according to Art. 2 these documents are processed by the employer during the duration of the employment relationship according to the relevant contract and subsequently after his termination after time required relevant legal regulations, determining obligation their processing.</p>
          <p className="mb-3 ml-4">2.6. Personal data employee according to Art. 2 this one document is employer authorized to process in the scope resulting from mentioned article and that exclusively for purpose fulfillment obligations resulting from employment relationship.</p>
          <p className="mb-6 ml-4">2.7. Personal data according to Art. 2 this one document is employer authorized to hand over institutions for the purpose of fulfilling their obligations arising from the employment relationship (in particular to the relevant tax administrator, the provider health employee insurance, social insurance company, statistical office). The employer is obliged to provide this data to the above-mentioned entities. The employer does not transfer the employee's personal data to third countries (outside the EU).</p>

          <h3 className="font-bold mb-3">3. Processing personal data from reason fulfillment contractual obligations</h3>
          <p className="mb-3 ml-4">3.1. Employer is authorized to process personal data employee in the range his identification data, agreed type of work and agreed place of work for the purposes of concluding agreements on material liability, about responsibilities for loss entrusted objects, agreements about precipitation from wages or other agreements, the conclusion of which is permitted by the Labor Code, and for the purposes of fulfilling these agreements.</p>
          <p className="mb-3 ml-4">3.2. The employer is further authorized to process the employee's personal data to the extent of his/her identification data, the agreed type of work, and the agreed place of work for the purposes of recording the submitted access credentials. and security resources on security entry employee to premises employer, which are provided to the employee on the basis of separate agreements on the transfer of these funds.</p>
          <p className="mb-3 ml-4">3.3. Processing personal data according to Art. 3 this one document is employer authorized to carry out for the purpose of concluding the agreements in question and their subsequent performance, while the processing period is limited by the period duration agreements, possibly time necessary for solution claims any parties arising from the agreement, if such claims persist after the termination of the agreement.</p>
          <p className="mb-6 ml-4">3.4. Providing personal data to the employer for the purposes described in Article 3 of this document is mandatory for the employee; without this data, the employer cannot properly conclude the relevant agreements with the employee and fulfill the obligations and exercise the rights arising from them.</p>

          <h3 className="font-bold mb-3">4. Processing personal data on basis authorized interests' employer</h3>
          <p className="mb-3 ml-4">4.1. The employer is entitled to process for the purposes of its legitimate interests or the interests of a third-party employee's personal data to the following extent and for the following purposes:</p>
          <div className="ml-8 mb-6 space-y-2">
            <p>4.1.1. phone number and the employee's private email address for the purpose of ensuring communication and providing information between employers and employees, especially during incapacity for work employee.</p>
            <p>4.1.2. use, or possibly production of a portrait photograph of an employee and its publication for the purpose of identification of the employee by other employees of the employer; placement of the photograph in the employer's premises for the purpose of marking and identifying the employees' offices,</p>
            <p>4.1.3. making a camera recording of an employee in the company's entrance areas for the purpose of protecting the employer's property and ensuring security; the record containing personal data will be kept for 15 days from the moment of creation,</p>
            <p>4.1.4. execution audio recordings employee at telephone calls for purpose improvement quality services and resolution of employer's complaint procedures; record containing the personal data will be kept for 6 months from the moment of creation.</p>
          </div>

          <h3 className="font-bold mb-3">5. Processing personal data on basis consent employee</h3>
          <p className="mb-3 ml-4">5.1. By closing working contracts and by granting consent with processing personal data according to Art. 5 this one document provides employee to the employer consent with processing personal data for the following purposes:</p>
          <div className="ml-8 mb-3 space-y-2">
            <p>5.1.1. execution and use of photographs, video and audio recordings of an employee taken by the employer for internal and security purposes and for the purpose of promoting the employer and its products.</p>
            <p>5.1.2. Providing the employee's profile and data (especially CV) to third parties, namely other agencies, business partners, or customers of the employer, for the purpose of evaluating the employee's suitability for work performance for these entities and their subsequent selection.</p>
          </div>
          <p className="mb-3 ml-4">5.2. Personal data according to Article 5 of this document is obtained from the employee himself, and is accessible to all to others employees' employer. Employer is authorized personal data according to of this article to be made available to third parties only for the purpose of fulfilling the purposes specified in Article 5.1.1 of this document.</p>
          <p className="mb-3 ml-4">5.3. Consent according to this one article is granted on time duration working ratio employee. Employee However, the employee has the right to withdraw consent at any time by written or personal notification to his/her superior or the person authorized within the employer to manage the personal data agenda. Withdrawal of consent does not affect the lawfulness of the processing of personal data until the moment of withdrawal. Failure to grant or withdrawal of consent has no effect on the rights and obligations of the employee and the employer from employment relationship.</p>
          <p className="mb-3 ml-4">5.4. Employer is authorized to process personal data employee manually or automatically through own employees, possibly through specialized companies in intermediary status personal data (especially insurance Occupational health and safety, fire department protection). Personal data they will processed in form secured databases and they will be stored in personal writings with limited access by third parties.</p>
          <p className="mb-6 ml-4">5.5. The employer protects the processed personal data using organizational, physical and software means of protection, in particular by setting employees' access rights to the relevant information systems, by physically securing the employer's premises and data carriers and software protection against unauthorized access to data via the Internet. Principles general data and informational security establishes employer separate document.</p>

          <h3 className="font-bold mb-3">6. Information about rights employees in within processing personal data</h3>
          <p className="mb-3 ml-4">6.1. The employee has the right to request from the employer to provide him with access to his personal data in the form of a statement of all processed personal data in relation to the individual purposes of processing. Employee is also authorized to request information about intermediaries who on basis agreements with the employer, they process his personal data.</p>
          <p className="mb-3 ml-4">6.2. In case, that with employee believes, that employer his personal data processes in conflict with this document or with legal regulations, has law from employer to demand explanations and execution remedies. If processes employer inaccurate personal data employee, is employee entitled to request their correction.</p>
          <p className="mb-3 ml-4">6.3. Employee has law to demand from employer deletion their own personal data, if they stopped to be necessary on defined purposes processing or employee revoked yours consent with processing personal data and for this processing does not exist none other reason, possibly when employee raised objections to the processing of personal data and there are no overriding reasons for the processing.</p>
          <p className="mb-3 ml-4">6.4. The employee has the right to request from the employer restriction of the processing of personal data in the event that: when employee will attack accuracy personal data, and that on time necessary on that, so that the employer could verify the accuracy of the processed data, or the processing of personal data is unlawful according to the employee and the employee refuses to delete the personal data, or the employer does not need the personal data for the specified purposes of processing, but the employee requires it for the determination, exercise or defense of legal claims.</p>
          <p className="mb-6 ml-4">6.5. Employee has law to lift objection against processing their own personal data, processed on basis authorized interests' employer whether third parties according to Art. 4 this one document, if at the same time will introduce reasons concerning with his specific situations. Employer is on basis objections mandatory terminate the processing of data unless it proves that the reason for the processing, which is to protect its interests, outweighs the interests and freedoms of the employee.</p>

          <h3 className="font-bold mb-3">7. Final provisions</h3>
          <p className="mb-3 ml-4">7.1. In in case that employer will begin with processing personal data provided employees for purposes other than those arising from this document, immediately informs the relevant employees of this fact, informs their about individual aspects processing and in case, that is on processing for this purpose required consent employee, about this consent before by starting processing employee asks. In If the employee does not give consent, the employer is not entitled to proceed with further processing of personal data, unless another legal basis for processing is given.</p>
          <p className="mb-3 ml-4">7.2. This document is provided to each employee in written form and is continuously available to all employees on the employer's intranet.</p>
          <p className="mb-6 ml-4">7.3. List specific intermediaries, recipients and time processing personal data are available in independent document "List intermediaries and recipients' personal data and time their processing".</p>

          <p className="mt-8 font-semibold text-center border-t pt-6">I agree to provide my data and profile to other agencies, partners, or customers of the employer or the purposes of their selection process.</p>
        </div>
      </main>

      {/* Footer — same style as LandingPage */}
      <footer className="bg-[#0F172A] text-white py-12 font-sans">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center overflow-hidden">
                  {logoSrc ? <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" /> : <Briefcase className="w-5 h-5 text-white" />}
                </div>
                <span className="font-bold">{branding.companyName}</span>
              </div>
              <p className="text-sm text-gray-400 mb-4">{branding.footerTagline}</p>
              <div className="flex items-center gap-3">
                <a href={branding.linkedIn} target="_blank" rel="noopener noreferrer" className="hover:text-[#2563EB] transition-colors">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href={branding.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-[#2563EB] transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href={`mailto:${branding.emailInfo}`} className="hover:text-[#2563EB] transition-colors">
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
                <li><Link to="/jobs" className="hover:text-white transition-colors">Job Opportunities</Link></li>
                <li><Link to="/apply" className="hover:text-white transition-colors">Apply Now</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>{branding.address}</li>
                <li>{branding.phone1}</li>
                <li>
                  <a href={`mailto:${branding.emailInfo}`} className="hover:text-white transition-colors">
                    {branding.emailInfo}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/data-processing-agreement" className="hover:text-white transition-colors">Data Processing Agreement</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Staff Login</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8">
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-400">
              <p>&copy; {new Date().getFullYear()} {branding.companyName}. All rights reserved.</p>
              <p className="md:text-right">{branding.vatInfo}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
