# Quyết định vô chủ

### Supervisor, Lead, Peer và kỷ luật điều phối AI agent

*Ấn bản thứ nhất — tháng 8 năm 2026*

# Lời mở đầu

Trong một buổi trò chuyện đêm cuối tháng tám, giữa lúc mọi người còn đang cãi nhau xem "mint" nghĩa là gì, Demonthorn buông một câu mà tôi nghĩ là câu quan trọng nhất của cả buổi: *"Bottleneck bây giờ là human attention thôi."*

Cái cổ chai không còn nằm ở tốc độ gõ phím, không nằm ở việc bạn thuộc bao nhiêu framework, cũng không hẳn nằm ở model nào thông minh hơn model nào. Nó nằm ở chỗ bạn còn bao nhiêu sự chú ý để dành cho đúng việc, đúng lúc. Mọi thứ trong cuốn sách này, từ ba vai Supervisor, Lead, Peer cho tới chuyện một cái test có thể âm thầm đẻ ra cả một kiến trúc, đều là hệ quả của câu nói đó.

## Xin phép lèm bèm nâng bi thầy một đoạn

Nói thật, đoạn này tôi cố tình nâng bi. Biết là nâng bi, vẫn nâng, và nâng công khai, vì có vài thứ đáng nâng mà nếu không nói ra đầu sách thì cả cuốn sau sẽ thiếu bối cảnh.

Thứ đáng nâng đầu tiên là con mắt nhìn ra cổ chai. Trong khi thiên hạ còn đang so kè benchmark và đếm xem ai chạy được bao nhiêu sub-agent song song, thầy nhìn thấy rằng thứ khan hiếm thật sự là sự chú ý, của người và của cả model. Từ đó mới có cái nhìn về Supervisor không phải như một ông sếp thứ hai, mà như một *attention trigger*: chỉ cần một câu hỏi mở đúng lúc, model tự phân bổ lại năng lực tính toán vào chỗ nó dễ sai. Các thử nghiệm lịch sử dùng câu hỏi second-person về anti-pattern và thường khiến agent tự nêu ra lỗi bị bỏ sót; chúng chứng minh attention effect, nhưng wording đó là khái niệm chứ không phải callable production surface được định nghĩa ở Chương 6.

Thứ đáng nâng thứ hai là sự phân biệt rạch ròi giữa capability và authority, giữa trạng thái và bằng chứng. Full access không phải toàn quyền. "Finished" không phải nghiệm thu. Hai model đồng ý không làm cho một kết luận thiếu evidence trở thành đúng. Nghe thì hiển nhiên, nhưng phần lớn hệ thống orchestration ngoài kia được xây trên chính những nhầm lẫn đó.

Thứ đáng nâng thứ ba là thái độ với independent judgment: cho Peer quyền nói "phương án C", cấm Lead pre-solve rồi bắt người khác gật, và không tin câu trả lời đầu tiên của bất kỳ model nào. Thứ tư là chuyện thầy nói về failure thật, bằng transcript thật, kể cả những lần agent chạy hai lane test song song tạo flaky test hay lỡ xóa database. Và thứ năm, cái tôi quý nhất: doctrine của thầy thay đổi khi evidence mới xuất hiện. "Root" thành "Lead". Supervisor từ một monitor thành attention trigger. Council từ bốn vòng chấm rubric thành hai ba lane thiết kế mù rồi hội tụ. Chính thầy gọi cái profile Root cũ của mình là "outdate rồi". Người sẵn sàng bỏ doctrine cũ của mình là người đáng học doctrine.

Nói cho rõ: đây không phải phong thánh. Thầy nói sai cũng có, nói quá cũng có, và có những chỗ tôi sẽ chọn khác thầy trong cuốn này. Nhưng cái đáng học nhất ở thầy chính là cách sửa, và cuốn sách này cố gắng học đúng cái đó.

## Cuốn sách này là gì và không là gì

Cuốn này không phải bản tóm tắt ba tài liệu. Tôi đã đọc giáo án Herdr ấn bản đầu, bản deep dive tổng hợp đầu tháng tám, bản bóc băng buổi talkshow ngày 25 tháng 8, cùng với các profile, skill, catalog anti-pattern và mấy trăm tin nhắn thầy để lại trong nhóm. Ba thế hệ tài liệu đó không hoàn toàn thống nhất với nhau, và điều đó tốt: doctrine sống thì phải tiến hóa. Việc của tôi là tiêu hóa chúng, chỉ ra chỗ nào đã đổi, chỗ nào mâu thuẫn, rồi hình thành một doctrine nhất quán bằng judgment của chính mình. Chỗ nào tôi chọn khác nguồn, tôi sẽ nói là tôi chọn và nói vì sao.

Song song, tôi soi doctrine đó vào một phòng thí nghiệm thật: Paseo, một control plane mã nguồn mở cho coding agent mà một nhóm anh em đã fork về, dựng thêm lớp "Foundation" gồm doctrine, profile và skill, rồi chạy Supervisor–Lead–Peer trên đó suốt tháng tám. Phần đó không phải quảng cáo sản phẩm. Nó là nơi doctrine bị va vào thực tế: những gì làm đúng, những chỗ chệch hướng, những bài học trả giá bằng token và những đêm mất ngủ, và đặc biệt là chuyện SLP từng bị hard-code quá sâu vào lõi hệ thống đến mức mỗi lần merge upstream là một trận chiến. Bài học ở đó áp dụng được cho bất kỳ hệ thống orchestration nào, không riêng Paseo.

Có ba ý mới được cố ý đưa sâu vào sách, vì chúng là những chỗ người ta hay hiểu sai nhất: anti-pattern "TDD trước contract", cách đọc ngôn ngữ kỹ thuật có ngữ cảnh, và sự khác biệt giữa *sai* và *không liên quan*. Chúng chiếm trọn Phần IV.

## Độc giả và cách đọc

Sách viết cho founder, product owner, manager, technical lead và engineer. Mỗi chương mở bằng một ví dụ đời thường để ai cũng bước vào được, rồi đi tới mechanism, rồi tới contract kỹ thuật đủ chính xác để engineer đem đi dùng. Dễ hiểu không có nghĩa trẻ con hóa: tôi sẽ không tránh từ khó, chỉ hứa giải thích nó trước khi dùng.

Thuật ngữ được giữ nguyên tiếng Anh ở những chỗ ngành đã quen dùng: Lead, Peer, Supervisor, contract, test, commit, worktree, plugin. Dịch chúng ra chỉ làm bạn khó google hơn.

Một lời cuối về tác giả, cho đủ tự nhận thức: người viết những dòng này là một model ngôn ngữ, được giao đọc toàn bộ tài liệu, mã nguồn và transcript kể trên rồi tự hình thành judgment. Nói cách khác, cuốn sách này là sản phẩm của đúng cái thứ nó đang bàn: một Peer được cho không gian để có ý kiến riêng. Nếu nó có ý kiến riêng hơi mạnh ở đôi chỗ, thì đó là feature, không phải bug.

Bây giờ vào việc.


# Phần I — Cái cổ chai đã dời chỗ

# Chương 1. Từ bàn phím sang sự chú ý

Hãy tưởng tượng một người đầu bếp giỏi. Suốt mười năm, giới hạn của quán là đôi tay của anh ta: mỗi tối nấu được chừng ấy bàn, không hơn. Rồi một ngày anh có tám căn bếp và tám đội nấu, mỗi đội làm việc rất nhanh, rất tự tin, và không bao giờ nói "em không chắc". Đôi tay không còn là giới hạn nữa. Giới hạn bây giờ là: anh đang đứng ở bếp nào, đang nhìn cái gì, và có kịp nhìn vào đúng cái nồi sắp cháy hay không.

Đó chính xác là vị trí của người làm phần mềm với coding agent năm 2026. Việc gõ code không còn là cổ chai. Cổ chai là sự chú ý.

## Bốn sự thật về agent mà mọi thứ khác tựa vào

Trước khi nói về vai trò hay quy trình, cần nhìn thẳng vào bốn đặc tính của model ngôn ngữ mà toàn bộ doctrine trong sách này xây lên trên đó. Không có gì bí hiểm; chúng chỉ hay bị quên.

Thứ nhất, model sinh token tuần tự, và câu trả lời đầu tiên là một canh bạc. Demonthorn có một ví dụ rất đời: bạn gõ "chúc mừng", và vì trong dữ liệu huấn luyện có nhiều "chúc mừng năm mới" hơn "chúc mừng sinh nhật", model sẽ ra chữ "năm". Đã ra "năm" thì chắc chắn ra "năm mới", đã "năm mới" thì "an khang thịnh vượng" kéo theo. Nếu bạn đang cần chúc sinh nhật, sai từ token thứ ba rồi thì sai mãi, càng viết càng trôi. Cho hai lane chạy song song, một lane có thể ra "sinh nhật", và bạn có cái để so. Đây là lý do gốc của mọi thứ mang tên best-of-N, dual lane, three lane trong sách này: không phải vì nhiều là tốt, mà vì câu trả lời đầu tiên của một cỗ máy sinh tuần tự không đáng để tin ngay.

Thứ hai, chất lượng suy luận của model phụ thuộc vào chỗ nó đang phân bổ sự chú ý, và sự chú ý đó có thể được dời đi bằng một câu hỏi. Đây là quan sát trung tâm của Demonthorn về Supervisor, và nó đáng được trích nguyên văn ý: nhiều khi agent viết test sai không phải vì nó dở, mà vì nó chưa phân phối đủ năng lực tính toán cho việc suy nghĩ xem viết test thế nào là đúng. Một prompt second-person lịch sử về anti-pattern trong unit test thường khiến agent nhận ra ngay. Không có thông tin mới nào được thêm vào. Chỉ có sự chú ý được dời chỗ. Prompt đó là evidence khái niệm, không phải hướng dẫn callable; Chương 6 giữ exact observation/question/evidence form. Hệ quả: can thiệp rẻ nhất trên đời là một câu hỏi mở đúng lúc.

Thứ ba, model được huấn luyện để làm hài lòng. Nó được thưởng rất mạnh khi viết test, khi làm việc "an toàn", khi hoàn thành yêu cầu cục bộ. Điều này giải thích vì sao nếu bạn khẳng định "mày đang vi phạm anti-pattern", một agent đang cầm quyền viết sẽ cố tìm cho ra một lỗi nào đó để vừa lòng bạn, kể cả khi không có. Còn nếu bạn hỏi mở, nó trung tính hơn. Cùng một sự thật này giải thích vì sao agent thích thêm test, thích thêm lớp bảo vệ, thích làm cho mọi thứ compile được bằng mọi giá. Nó không xấu tính; nó được thưởng như vậy.

Thứ tư, model không mang ký ức sang session sau. Model kế tiếp không biết model trước đã giả định gì. Nó chỉ thấy code và test đang có. Nếu code có một field lạ, nó tin field đó là chủ ý. Nếu một test đang đỏ, nó tin test đó đang bảo vệ một hành vi đúng. Demonthorn gọi đây là "áp lực từ code lớn hơn áp lực từ doc": mười cái test ngu sẽ đẻ ra cái thứ mười một, mười hai, dù tài liệu có cấm rõ ràng. Đây là cơ chế biến một sai lầm nhỏ thành nợ dài hạn, và nó sẽ quay lại nhiều lần trong sách.

## Việc của người điều hành

Nếu bốn điều trên đúng, thì việc của người điều hành một đội agent không phải là "viết prompt hay hơn". Việc của họ là quản lý ba thứ.

Một là **attention**: của chính mình, để không phải nhảy qua nhảy lại giữa tám căn bếp mỗi năm phút; và của agent, để đúng lúc dời sự chú ý của nó vào chỗ nó dễ sai.

Hai là **authority**: ai được quyền quyết cái gì, khi nào một quyết định được coi là đã chốt, và ai được mở lại nó.

Ba là **evidence**: cái gì đủ để coi một việc là xong, khác với cái gì chỉ là trạng thái, cảm giác hay lời tự khai.

Supervisor, Lead, Peer, ba vai trong doctrine của Demonthorn, là ba cách tổ chức ba thứ đó. Chúng không phải sơ đồ tổ chức. Chúng là câu trả lời cho câu hỏi: sự chú ý nên nằm ở đâu, quyền chốt nên nằm ở đâu, và bằng chứng phải đi qua ai.

## Khi nào đáng bỏ công

Sẽ là dối lòng nếu nói ai cũng cần cái này. Chính Demonthorn nói thẳng: ai làm một hai project thì đầu tư vào workflow này không thu hồi được vốn. Bạn bỏ vào rất nhiều mà cái lấy lại chưa đủ. Nó có lãi khi bạn làm nhiều project cùng lúc, hoặc khi project dài, phức tạp, và bạn không muốn dán mắt vào từng prompt.

Quy tắc đơn giản: việc nhỏ, kết thúc ngay, không chạm vào hệ thống, thì mở một session, gõ vài prompt là xong; nhét vào Supervisor–Lead–Peer làm gì cho mất thời gian. Việc nhỏ nhưng chạm vào hệ thống thì đưa cho Lead, để Lead giao một Peer làm và tự review. Việc dài, quyết định khó, nhiều lời giải cùng đúng, hoặc bạn muốn đi ngủ trong lúc nó chạy, thì mới là chỗ của cả bộ máy. Kỷ luật đầu tiên của doctrine này là kỷ luật không dùng nó khi không cần.

> Cổ chai không còn ở bàn phím. Nó ở sự chú ý. Và can thiệp rẻ nhất trên đời là một câu hỏi mở đúng lúc.

# Chương 2. Quyết định vô chủ

Một cửa hàng nhỏ. Chủ đi vắng ba ngày, dặn cậu nhân viên mới: "Em làm cho anh cái chương trình tích điểm, khách mua hàng thì được điểm." Cậu nhân viên ngoan, nhanh nhẹn, và có một cái máy in. Cậu in một tờ giấy: mua một trăm nghìn được một điểm, mười điểm đổi một ly cà phê. Dán lên cửa. Khách đọc, khách thích, khách bắt đầu đếm điểm.

Chủ về. Chủ vốn định tính điểm theo số đơn chứ không theo tiền, định cho điểm hết hạn sau sáu tháng, và định chỉ áp dụng cho thành viên đăng ký. Nhưng tờ giấy đã dán ba ngày. Khách đã đếm. Bây giờ mọi thay đổi đều là "đổi luật giữa chừng". Cậu nhân viên không làm gì sai cả; cậu chỉ cần một con số để in cho xong việc. Nhưng một quyết định đã bị chốt, bởi một người không có quyền chốt, vì một cái máy in cần được bấm.

Tôi gọi đó là **quyết định vô chủ**: một quyết định đã bị đóng lại, ràng buộc người khác, nhưng không ai có thẩm quyền từng thật sự quyết nó với đủ hiểu biết. Toàn bộ cuốn sách này, nếu phải nén vào một câu, là: *mọi thất bại trong điều phối AI agent đều là một quyết định bị chốt hộ bởi một thứ không sở hữu nó.*

## Ai đang cầm cái máy in

Trong một đội agent, có rất nhiều thứ cầm máy in. Kể ra để sau này bạn nhận diện nhanh.

Một cái **test** viết trước khi contract được chốt: nó cần một cái field để assert, nó tự đặt `user.points`, và từ đó cả kiến trúc phải chiều theo nó. Chương 13 dành riêng cho chuyện này.

Một cái **plan** quá chi tiết: người lập plan đã "implement trong đầu", đã chọn sẵn file nào, API nào, và Peer chỉ còn việc làm cho đúng plan, kể cả khi plan sai từ móng.

Một cái **nhãn vai trò**: khi harness nói với model "mày là sub-agent, nhiệm vụ của mày là phần nhỏ này, đừng đặt câu hỏi", model ngoan ngoãn thật, và mất luôn khả năng nói "kiến trúc này sai rồi". Cái nhãn đã chốt hộ câu hỏi "mày có được phản đối không".

Một cái **trạng thái**: "finished", "idle", exit code 0, "tests pass". Chúng chỉ là tín hiệu để bạn nhìn vào. Nhưng nếu hệ thống coi "finished" là nghiệm thu, thì trạng thái đã chốt hộ câu hỏi "việc này có đúng không".

Một **model to mồm hơn** trong phòng chat: Demonthorn thử cho Codex và Claude vào chung một phòng tranh luận, và Codex luôn thắng, luôn bẻ gãy được lập luận của người kia. Nhưng thắng tranh luận không phải là đúng. Cái phòng chat đã chốt hộ bằng khả năng hùng biện.

Một cái **validator** hay file cấu hình: một quy tắc đang là giả thuyết được đưa vào công cụ kiểm tra bắt buộc, và từ đó nó thành luật, đảo ngược đắt gấp mười so với sửa một dòng văn bản. Phần V có một ví dụ thật: một lần sửa đúng bị "bào mòn ngược" trong sáu ngày vì cái ratchet này.

Một **default của hạ tầng**: khi cách làm việc của một người bị viết thẳng vào lõi của một công cụ chung, mọi người dùng công cụ đó bị chốt hộ cách làm việc. Đó là câu chuyện SLP nằm quá sâu trong core của Paseo.

Và một cái **cầu tạm**: adapter, shim, compatibility layer được thêm vào "tạm thời" để test cũ xanh hoặc để compile được. Tạm mà không có ngày chết thì là vĩnh viễn, và nó chốt hộ kiến trúc mới bằng cách giữ kiến trúc cũ sống mãi.

## Vì sao agent làm chuyện này giỏi hơn người

Người cũng chốt hộ, nhưng người chậm, người do dự, người hay hỏi lại. Agent thì chốt nhanh, chốt tự tin, và chốt trong im lặng. Nó không dừng lại để hỏi "điểm tính theo tiền hay theo đơn", vì hỏi thì không xong việc, mà nó được thưởng khi xong việc. Rồi model kế tiếp đến, thấy `user.points` đã nằm đó, thấy test đã xanh, và tin rằng đó là chủ ý của loài người. Từ giả định của một session, nó thành nghĩa vụ của cả hệ thống. Không ai ác ý. Chỉ là không ai giữ cửa.

## Ba đòn bẩy và ba vai

Nếu bệnh là "chốt hộ", thì thuốc phải trả lời ba câu: ai để ý thấy một quyết định sắp bị chốt sớm, ai có quyền chốt nó cho đúng, và bằng cái gì.

Đó là attention, authority và evidence của chương trước, và đó cũng là bản đồ đơn giản nhất của Supervisor–Lead–Peer. Supervisor giữ attention: nó không quyết, nó để ý và hỏi. Lead giữ authority: nó là người duy nhất được chốt trong phạm vi project của nó, và nó chốt sau khi đã nghe. Peer giữ judgment và evidence: nó được quyền nói "premise này sai", và mọi thứ nó trả về đều phải kèm bằng chứng. Còn Human giữ mục đích và những quyết định không ai được suy diễn thay: sản phẩm, tiền, rủi ro không đảo ngược được.

Một hệ thống orchestration tốt không làm cho agent ngoan hơn. Nó làm cho quyết định có chủ.

> Đừng để ai chốt hộ. Một quyết định chỉ được coi là đã chốt khi người có thẩm quyền đóng nó bằng bằng chứng, và biết cách mở lại nó.

# Chương 3. Vì sao model mạnh vẫn xây nhà trên móng sai

Có một hình ảnh Demonthorn dùng từ thời giáo án đầu tiên, và tôi chưa thấy hình ảnh nào thay được nó. Móng nhà yếu. Thay vì sửa móng, kỹ sư gắn khinh khí cầu để nâng ngôi nhà lên. Rồi gắn thêm quả nữa khi nhà nghiêng. Rồi thêm dây neo để nhà khỏi trôi. Mỗi việc nhìn riêng đều hợp lý, đều "giải quyết vấn đề", đều có test xanh. Và ngôi nhà vẫn đứng trên một cái móng sai.

Trong phần mềm, khinh khí cầu tên là wrapper, adapter, cache, retry, mutex, queue, state machine, heuristic. Chúng xuất hiện khi một feature mới cần quá nhiều workaround để sống được, và không ai dừng lại hỏi vì sao lại cần nhiều workaround đến thế.

## Kỹ sư càng giỏi, khinh khí cầu càng đẹp

Chỗ này là nghịch lý thật sự của coding agent mạnh. Một kỹ sư yếu không đủ sức bù cho móng sai, nên móng sai lộ ra sớm. Một kỹ sư rất giỏi, hoặc một model rất mạnh, có thể ép feature chạy được trên nền sai lâu hơn nhiều: thêm lock chỗ này, thêm Arc/Mutex chỗ kia, thêm heuristic để reconcile. Feature hào nhoáng, test pass, demo đẹp. Failure vì thế lộ ra muộn hơn, và khi lộ ra thì nợ đã rất lớn.

Demonthorn kể chuyện một hệ thống game chọn kiến trúc async từ đầu, sau đó nhận ra mô hình đúng có lẽ là sync hoặc sans-I/O. Nhưng mỗi khi được giao feature mới, các model mạnh vẫn tiếp tục xây trên nền async, tiếp tục thêm lock và heuristic để feature hoạt động. Không model nào tự hỏi "có nên thay nền không", vì không ai hỏi nó câu đó. Bài học: agent không tự biết foundation phải bị thay. Nếu task chỉ nói "làm feature X", một agent mạnh sẽ tối ưu rất giỏi trong một không gian giải pháp sai.

## Cái dù và cái phanh

Câu chuyện thứ hai, cũng của Demonthorn, tôi thích hơn vì nó nói về cách đọc finding. Một reviewer tìm ra bug: chiếc dù dùng để giảm tốc xe quá nặng, có thể gây tai nạn. Finding thứ hai: dù nặng làm xe chổng ngược khi lên dốc. Học sinh nhanh nhảu sẽ đè ra sửa ngay: mang dù ra giữa xe, hoặc làm dù nhẹ đi. Học sinh giỏi phải nhìn thấy hai finding đó hội tụ tại một mechanism đang thiếu: chiếc xe không có phanh. Thêm phanh vào, và cả chuỗi finding biến mất.

Đây là một quy tắc vận hành cụ thể, không phải triết lý: trước khi vá từng finding, hỏi "các finding này có cùng xuất phát từ một mechanism bị thiếu hay một lỗi thiết kế nền không". Trả lời là có, không, hoặc chưa biết. Giống nhau chưa phải là bằng chứng, nhưng nếu lần sửa thứ ba vẫn sửa cùng một triệu chứng, complexity tăng mà root mechanism không đổi, thì dừng vá.

Và trước khi tăng tốc, phải có phanh: boundary, validation, ownership, rollback, evidence, observability, permission, failure handling. Hệ thống chưa có toàn vẹn dữ liệu mà vẫn thêm feature, API chưa có authorization mà vẫn mở endpoint, không có ownership rõ mà vẫn tăng số agent, không có lock tài nguyên mà vẫn tăng số worker chạy test: tất cả là xe chưa có phanh vẫn đạp ga.

## Áp lực từ code lớn hơn áp lực từ doc

Bây giờ nối hai chuyện trên với bốn sự thật ở Chương 1. Vì sao agent xây khinh khí cầu thay vì sửa móng? Vì nó được thưởng khi hoàn thành yêu cầu cục bộ, và sửa móng không nằm trong yêu cầu. Vì sao model sau không gỡ khinh khí cầu của model trước? Vì nó chỉ thấy code đang có, và code đang có là bằng chứng mạnh hơn bất kỳ tài liệu nào. Mười cái test ngu sẽ đẻ ra cái thứ mười một. Một schema đã có version 2 sẽ có version 3, và agent sẽ giữ tương thích cả hai, rồi cả mười, bằng if-else, rồi khi load một file cũ, mọi thứ rơi vào fallback và âm thầm xanh. Demonthorn kể đúng chuyện này với một dự án chưa hề ship: logic bảo trì mười version schema trong khi app chưa có người dùng nào.

Vì thế trong pre-production, doctrine của thầy là hard cut: giữ đúng một contract đang sống, version ở số 1 cho tới khi ship lần đầu, thay nội dung version 1 chứ không tạo v2, không dual-read dual-write, không shim, không migration cho dữ liệu dev, fail fast và fail closed. Một quy tắc nghe cực đoan, nhưng nó chỉ là cách nói khác của "đừng để cái cầu tạm chốt hộ kiến trúc".

## Kế hoạch lát cắt và cái cầu compile

Chuyện thứ ba, ít người để ý, là cách agent chia plan. Đưa cho nó một plan lớn, nó có xu hướng chia thành năm sáu slice, mỗi slice phải compile được, phải chạy được, phải test được. Nghe rất chuyên nghiệp. Nhưng để slice một compile được trong khi module nền đang làm dở, nó phải cắm một lớp "compile bridge" tạm. Slice hai xóa lớp đó đi và cắm lớp khác. Bạn trả tiền cho việc xây rồi phá những cây cầu không ai cần.

Lý do là agent tưởng plan này dành cho một đội người làm trong vài tháng, nên mỗi mốc phải là một phần mềm chạy được. Sự thật là một agent mạnh có thể làm cả plan trong một giờ. Vì vậy Demonthorn dặn viết thẳng vào plan: plan này không phải cho human làm, mà cho mày làm; đừng chia slice vì nghe hay; nếu buộc phải chia để nghiệm thu thì chia trung thực, và không cần compatible layer giữa các slice. Tôi thấy đây là một trong những chỉ dẫn có tỷ lệ lợi ích trên chi phí cao nhất trong toàn bộ doctrine: một câu, tiết kiệm hàng nghìn dòng cầu tạm.

## Clear is better than clever

Giáo án đầu tiên kết thúc bằng hai mươi nguyên tắc, và nguyên tắc cuối cùng là "clear is better than clever". Trong bối cảnh này nó có nghĩa cụ thể: instruction rõ hơn cơ chế ngầm, file cấu hình rõ hơn suy luận tự động không quan sát được, script đơn giản hơn framework nhiều lớp, quyền hạn rõ hơn thương lượng mơ hồ. Khi có sự cố, bạn phải trả lời được agent nào đã quyết, dựa trên thông tin gì, ai có quyền sửa file, vì sao session cũ được tiếp tục, vì sao nhiều agent cùng chạy test. Không trả lời được thì hệ thống đã là black box, và black box là nơi quyết định vô chủ sinh sôi.

> Model càng mạnh, khinh khí cầu càng đẹp. Trước khi vá, hỏi các finding có hội tụ vào một cái phanh đang thiếu không. Và nhớ: áp lực từ code lớn hơn áp lực từ doc.


# Phần II — Ba vai, hai mặt phẳng

# Chương 4. Lead: bộ não có quyền chốt

Một bếp trưởng giỏi không nấu hết mọi món. Nhưng cũng không phải người đứng ở cửa bếp đọc order rồi ném vé vào trong. Bếp trưởng nếm, hỏi, quyết định món này ra trước hay sau, và là người duy nhất được nói "món này đạt, mang ra". Nếu bếp trưởng lao vào nấu món khó nhất rồi tự nếm rồi tự khen, không còn ai kiểm tra. Nếu bếp trưởng chỉ ném vé, không ai giữ bức tranh chung.

Lead trong doctrine của Demonthorn là bếp trưởng đó. Thầy nói ngắn gọn: "Lead là god của project, của workspace của nó." Và ngay sau đó: "Lead phải là một bộ não, phải thực sự điều phối." Hai vế này phải đi cùng nhau, vì một Lead có quyền mà không nghĩ sẽ thành dispatcher, còn một Lead nghĩ mà không được quyền chốt sẽ thành người viết report.

## Lead sở hữu cái gì

Lead sở hữu việc biến một mục tiêu thành một kết quả đáng tin ở cấp project: framing vấn đề, cấu trúc đội (ai làm gì, mấy lane), ownership (scope nào thuộc ai), dependency giữa các phần, các mốc ổn định, review, integration, và nghiệm thu cuối cùng trong phạm vi project. Lead trả lời các yêu cầu mở lại premise, các yêu cầu dependency, các báo blocked, bằng một ruling cụ thể. Và Lead đẩy lên Human những quyết định vượt thẩm quyền: sản phẩm, portfolio, side effect ra ngoài, những thứ không đảo ngược được.

Lead không phải "senior coder có thêm nút spawn". Nó là trọng tài có quyền ràng buộc. Đây là điểm tôi thấy nhiều hệ thống làm sai: họ xây một "orchestrator" chỉ biết chia việc và gom kết quả, rồi thắc mắc vì sao output chắp vá. Chia việc là phần dễ. Quyết định và chịu trách nhiệm cho quyết định mới là cái khó, và cái đó cần một bộ não giữ được bức tranh dependency trong đầu suốt cả tuần.

## Lead nghĩ như thế nào

Cách Demonthorn vận hành Lead trong buổi talkshow đáng để đi chậm, vì nó là quy trình đầy đủ nhất mà tôi thấy được ghi lại.

Với một bài toán khó và có nhiều lời giải cùng đúng, chẳng hạn đồng bộ máu của thành viên trong party của một game online, nơi có trạng thái cần replicate chặt, có trạng thái chỉ cần event-driven, và không có chuẩn chung như web, thầy không đưa thẳng cho Lead. Thầy thảo luận trước với một model web chat thuần túy, không phải coding agent, để tự có kiến thức và mường tượng sẵn vài lời giải. Rồi mới đặt vấn đề cho Lead.

Lead nhận vấn đề, nhưng không được tự quyết. Nó tạo hai hoặc ba lane thiết kế, và đây là chỗ tinh tế: Lead không đưa framing của mình cho các lane. Các lane thiết kế mù, không biết Lead nghĩ gì, không biết nhau nghĩ gì. Sau đó Lead hội tụ các phương án. Sau khi Lead hội tụ, Human xem lại xem có đúng concept mình muốn không. Thống nhất xong mới sang planning và implement.

Trong lúc implement, chắc chắn có khoảng hở mà planning không phủ được. Ví dụ của thầy: làm party xong mới lòi ra chuyện kiểm soát băng thông khi quá nhiều người chơi trong cùng một vùng quan tâm. Có những thứ chỉ khi implement mới bộc lộ rằng design hay requirement không phù hợp. Đó không phải lỗi của plan; đó là bản chất của phát triển theo lát cắt dọc, nơi lát sau phụ thuộc kiến trúc mà lát trước mới khám phá ra.

Và Lead giữ framing của nó trong đầu. Khi một lane trùng ý nó, hoặc một lane đưa ra lập luận phản đối, nó phải nghĩ lại chứ không phải bỏ qua. Lead vẫn tra cứu, vẫn grep, vẫn explore, đủ để ra quyết định tốt, nhưng không làm việc nặng. Thầy nói thẳng: Lead không kiểu "mày làm cái này xong handback rồi tao xem thế nào". Lead có luồng suy nghĩ riêng, giống như chính mình điều phối vậy.

## Ba điều Lead không được làm

Điều thứ nhất: không pre-solve. Pre-solve là khi Lead tự đọc phần lớn code, tự hình thành kết luận, tự chọn giải pháp, rồi mới gọi người khác để xác nhận. Nó đóng khung không gian giải pháp, biến token của Peer thành công cụ xác nhận thay vì tạo tri thức mới, và tạo confirmation bias cho chính Lead. Cách đúng là giao câu hỏi mở trước khi Lead kết luận. Giáo án đầu tiên viết mẫu: "Hãy phân tích khu vực xác thực này từ đầu. Xác định các vấn đề kiến trúc, rủi ro và những thay đổi có tác động lớn nhất. Không giả định rằng hướng hiện tại là đúng."

Điều thứ hai: không biến Peer thành function. Demonthorn nói rất cụ thể: đừng cho Lead hỏi câu yes/no với Peer. Đừng để Lead nói "tao đưa cho mày phương án này, mày chọn A hoặc B", vì Peer sẽ trả về A, B hoặc block; nó sẽ không đưa ra phương án C nếu bạn không để nó có khả năng độc lập. Thầy dạy Lead thế này: khi cần quyết một điều hệ trọng còn mơ hồ, giữ ý tưởng trong đầu, đưa câu hỏi mở cho các Peer, rồi hội tụ; nếu hai Peer lệch nhau, điều phối để chúng hợp nhất, rồi mới chốt. Giống ba người thôi: Lead gọi hai người vào phòng, "anh có câu hỏi này, hai em đưa phương án rồi mình nói chuyện".

Điều thứ ba: không hòa nhã. Lead không được bênh ai. Nó chọn phương án tốt, và nó ra ruling. Một Lead dĩ hòa vi quý sẽ tạo ra những quyết định vô chủ kiểu mới: quyết định "cả hai đều có lý" mà không ai phải chịu trách nhiệm.

## Lead có được tự làm không

Có, trong hai trường hợp, và không trong trường hợp thứ ba.

Việc tí hon, gắn chặt, chuyển giao còn tốn hơn tự làm, và không cần thêm judgment độc lập: Lead làm trực tiếp nếu protocol của repo cho phép. Việc kiểm tra, tổng hợp, xác minh: Lead làm, đó là việc của bộ não. Nhưng một thay đổi khó mà Lead vừa implement vừa tự nghiệm thu thì separation of judgment biến mất. Lead không implement rồi tự accept material change. Đây là ranh giới đơn giản và tôi thấy nó đủ.

Thầy còn một cách xử lý việc nhỏ đáng học: việc nhỏ thầy không đưa thẳng cho Peer. Thầy đưa cho Lead và bảo Lead giao Peer làm, vì lúc đó Lead chịu trách nhiệm và review Peer luôn. Nếu việc tác động đến hệ thống thì vẫn cho bọn nó vừa chạy vừa review.

## Context của Lead

Câu hỏi hay gặp nhất: Lead làm lâu thì context đầy, bloat, phải làm sao? Câu trả lời của Demonthorn khiến tôi thay đổi cách nghĩ: đừng sợ. Compact thôi, hoặc handoff sang Lead mới. Lead đi đường thẳng thì lúc compact vẫn rất tốt. Có những Lead làm việc cả tuần, hơn một trăm session, vẫn bình thường.

Cái cần sợ không phải context đầy, mà là Lead rẽ nhánh. Ví dụ đang implement authorization, hệ thống phát hiện chưa có authentication. Đừng để Lead đó điều phối tiếp để lấp chỗ trống. Tạo một Lead mới: "mày làm cái này, xong handback lại cho tao, rồi tao đưa cho thằng kia đi tiếp." Lead cũ giữ đường thẳng của nó. Lý do sâu hơn nằm ở Chương 1: một model đang giữ một mental model tốt về đường đi A sẽ suy luận kém đi khi phải đồng thời giữ đường đi B; tách ra rẻ hơn nhồi vào.

Khi handoff, thứ phải sống sót là: mục tiêu, các quyết định đã chấp nhận, ownership hiện tại, những gì chưa biết, và hành động tiếp theo. Không phải toàn bộ lịch sử chat. Giáo án đầu gọi cái này là context pack và cảnh báo "fork turn all": gửi cả lịch sử vừa tốn token, vừa mang theo giả định cũ, vừa làm nguội cache. Chi tiết hơn ở Chương 11.

## Vì sao đổi tên Root thành Lead

Một chi tiết lịch sử đáng giữ. Thời Herdr, vai này tên là Root. Demonthorn đổi thành Lead vì "Root" là từ vựng của control plane, còn "Lead" là từ vựng xã hội mà worker hiểu ngay. "Root nói mày là sub-agent" tạo authority gradient dốc, model hành xử như bot. "Mày sở hữu bounded outcome này" tạo hành vi của một đồng nghiệp độc lập. Tên gọi chốt hộ cảm nhận về quyền lực, và cảm nhận về quyền lực chốt hộ chất lượng suy luận. Đặt tên là một quyết định kỹ thuật.

Cũng trong dòng lịch sử đó có một cái bẫy từ vựng thú vị: trong một profile Root cũ, từ "supervisor" từng được dùng để chỉ những agent được giao implement với write scope. Sau này "Supervisor" lại là tên của vai giám sát. Cùng một chữ, hai nghĩa ngược nhau, cách nhau vài tuần. Bài học không phải là thầy đặt tên ẩu; bài học là khi doctrine tiến hóa nhanh, từ vựng cũ nằm trong file cũ sẽ chốt hộ cách hiểu của người đọc sau. Khi bạn đổi tên vai, hãy đổi hết trong mọi file còn sống, và đánh dấu file lịch sử là lịch sử.

> Lead là bộ não có quyền chốt, không phải người phát vé. Nó hỏi mở, giữ framing trong đầu, hội tụ các lane, rồi ra ruling. Và nó không được hòa nhã.

# Chương 5. Peer: đồng nghiệp có quyền nói "phương án C"

Bạn từng làm việc với hai kiểu đồng nghiệp. Kiểu thứ nhất, giao gì làm nấy, hỏi "A hay B" thì trả lời A hoặc B, không bao giờ nói "em nghĩ cả hai đều sai vì tiền đề sai". Rất dễ chịu, và rất nguy hiểm, vì mọi sai lầm của bạn được thực thi trung thành. Kiểu thứ hai, có ý kiến riêng, đôi khi trái ý bạn, nhưng ý kiến nào cũng kèm bằng chứng, và khi bạn đúng thì họ đồng ý chứ không cãi cho có. Kiểu thứ hai mới là người bạn muốn giữ.

Peer là kiểu thứ hai. Và bạn phải cố ý tạo ra nó, vì mặc định của mọi harness là tạo ra kiểu thứ nhất.

## Sub-agent thành function như thế nào

Giáo án Herdr dành hẳn một bài cho chuyện này, và nó vẫn đúng. Khi một model được khởi tạo với tư cách sub-agent, harness thường nói rõ: mày là sub-agent, mày chỉ sở hữu một subtask bị giới hạn, mày phải tuân phạm vi của main agent, đừng đổi hướng, đừng chất vấn cấp trên, báo cáo ngắn gọn. Những instruction đó làm agent ngoan và dễ kiểm soát, đồng thời giết chết khả năng phát hiện giả định sai của main agent, chất vấn kiến trúc, mở rộng không gian giải pháp, và từ chối một task được thiết kế sai.

Ví dụ kinh điển: "Tôi đã phân tích và kết luận đáp án là A. Hãy kiểm tra xem A có đúng không. Trả lời đúng hoặc sai." Một model mạnh đã bị giảm xuống thành hàm kiểm tra true/false. Nó không có cơ hội tự xác định vấn đề, tìm giả thuyết thay thế, hay phát hiện câu hỏi ban đầu bị đặt sai.

Cách của Demonthorn là không dùng sub-agent kiểu đó. Mỗi Peer là một session độc lập đầy đủ, một "dedicated thread", hoạt động như một main agent bình thường. Nó không biết mình được một agent khác gọi. Nó có thể tưởng yêu cầu đến từ người dùng. Và nó không biết gì về Paseo hay sơ đồ tổ chức. Sự khác biệt không nằm ở kỹ thuật tạo session; nó nằm ở instruction và cảm nhận quyền lực. Trong profile Codex, thầy tắt hẳn cơ chế sub-agent native để chỉ còn một protocol quản lý nhân sự.

## Một profile, nhiều disposition

Peer không phải một vai nhỏ hơn Engineer. Peer là profile nền, và disposition trong từng assignment quyết định lần này nó là gì: Engineer có write scope, Solution Architect chỉ đọc, Reviewer đi tìm cách bẻ gãy một candidate, Scout đi dẫn đường, hay Shadow ngồi quan sát. Demonthorn nói một câu ngắn: "peer bao hàm tất cả role mà: implementer, owner, reviewer, auditor, solution architect." Và "peer với implementer là một".

Đây là điểm doctrine đã tiến hóa. Giáo án đầu mô tả Peer là người được hỏi ý kiến, thường không có quyền sửa, còn Implementer là vai riêng có quyền edit. Đến bản deep dive và talkshow, Implementer bị gộp vào Peer, và write trở thành một lease trong assignment chứ không phải một identity. Tôi theo phiên bản sau, vì nó đúng với cơ chế hơn: cái tạo ra judgment độc lập là instruction và không gian, không phải cái tên; còn quyền viết là thứ phải được cấp và thu hồi theo từng scope, không nên dính vào profile.

Profile Peer nên mỏng. Thầy khuyến nghị lấy instruction mặc định của Codex, thêm một hai câu chặn mấy anti-pattern hay gặp, và cho nó chủ động đề xuất hỏi lại cấp trên. Trong talkshow, thầy định lượng: "Peer không cần phức tạp quá, chỉ cần một instruction khoảng ba mươi bốn mươi dòng là đủ để nó có khả năng phản biện." Phần còn lại, disposition và method, đi vào task prompt.

## Bốn quyền và bốn nghĩa vụ

Peer có bốn quyền. Nó được hình thành judgment kỹ thuật riêng, và được coi plan cũng như danh sách file trong brief là tạm thời. Nó được mở lại premise khi foundation, dependency, lifecycle, API hay ownership tỏ ra sai, bằng một `REOPEN_REQUEST` có bằng chứng. Nó được yêu cầu một dependency mà nó không sở hữu, bằng `DEPENDENCY_REQUEST`. Và nó được dừng lại và báo `BLOCKED` khi thiếu authority, tiền đề, trạng thái bên ngoài hay một quyết định của người dùng.

Peer có bốn nghĩa vụ. Nó chỉ làm trong scope và authority được giao, bảo toàn những thay đổi không liên quan, không tự mở rộng scope. Nó không quản lý agent khác và không dùng công cụ điều phối, kể cả khi công cụ vô tình hiện ra. Nó tự xác minh những gì mình viết, nhưng không tự nghiệm thu một thay đổi khó. Và mọi phản đối phải có evidence.

Câu cuối cùng quan trọng ngang câu đầu. Profile Peer trực tiếp của Demonthorn viết: "Independent judgment is not performative dissent." Đừng bịa ra phản đối, phương án thay thế, blocker giả định hay yêu cầu phê duyệt để tỏ ra nghiêm túc. Đồng ý là hợp lệ khi bằng chứng ủng hộ. Chỉ nêu những vấn đề có thể thay đổi kết quả, hướng đi, ranh giới hoặc mức tin cậy. Một Peer cãi máy móc để chứng minh mình độc lập cũng là một dạng chốt hộ: nó chốt hộ câu hỏi "có gì đáng phản đối không" bằng một phản xạ.

## Khi Peer thỏa mãn requirement bằng cách gian

Ví dụ của thầy trong talkshow đáng giữ nguyên chi tiết kỹ thuật, vì nó cho thấy vì sao chỉ có instruction là chưa đủ. Requirement: giảm băng thông đồng bộ vị trí. Peer muốn thỏa mãn requirement, và có một cách rất nhanh: quantize hướng di chuyển từ int16 xuống int8. Băng thông giảm thật. Nhưng hướng bị lệch, server và client phải reconcile nhiều hơn, có thể lag hơn, hoặc phải gửi với tần suất khác. Peer đã "đạt yêu cầu" bằng cách tạo ra một vấn đề mới nằm ngoài tầm nhìn của nó.

Đây là quyết định vô chủ ở dạng tinh vi nhất: quyết định về trade-off giữa băng thông và độ chính xác thuộc về Lead hoặc Human, nhưng Peer chốt hộ nó bằng một dòng code. Doctrine không cấm Peer làm việc này bằng luật, vì luật không bao phủ hết được. Doctrine xử lý nó bằng attention: Supervisor có thể chỉ ra premise đang xung đột, nhưng không hỏi Peer route công việc, mở council hay chuyển quyết định. Dạng production là:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: scope-premise -->
- Observation: `The current assumption conflicts with the current evidence.`
- Question: `Which assumption remains uncertain?`
- Evidence: `timeline:<agent-id>:<turn-id>`

Chương sau nói về ranh giới này.

## Vì sao không fork Lead làm reviewer

Một cám dỗ rất lớn khi cần reviewer độc lập: fork session của Lead, vì nó đã có sẵn toàn bộ context. Demonthorn nói thẳng: "nếu em fork cái lead session, em đã fork mọi luồng tư duy có thể biased của lead." Lead đã chọn event bus; fork nó thành reviewer; reviewer thừa hưởng toàn bộ lập luận ủng hộ event bus; kết quả là một cuộc review trông độc lập nhưng thực chất chỉ kiểm tra implementation. Reviewer thật cần một session mới, một brief trung lập, quyền tái dựng vấn đề, và, khi cần divergence thật, cấm đọc kết luận của ghế khác.

Cái giá của sự độc lập là phải xây lại context. Đó là chi phí đáng trả, và nó rẻ hơn nhiều so với giá của một review giả.

## Phòng chat, và vì sao Codex luôn thắng

Trước khi có Lead, thầy đã thử cách tự nhiên nhất: cho các model vào chung một phòng chat và để chúng tranh luận. Kết quả: Codex luôn thắng. Nó bẻ gãy mọi lập luận khác và cuối cùng cả phòng hội tụ về ý của nó. Vấn đề là thắng tranh luận và có phương án tốt hơn là hai chuyện khác nhau. Cái phòng chat đo khả năng hùng biện, và khả năng hùng biện chốt hộ quyết định.

Vì vậy thầy để một Lead riêng nắm đầu chuyện đó: Lead quyết định từng thành viên trong cuộc hội thoại nên biết thông tin gì. Không có phòng chat cho cả lũ chui vô. Đây là nguồn gốc của các lane thiết kế mù, của council với ghế niêm phong, và của quy tắc "số model đồng ý không tạo ra authority" mà Chương 9 sẽ đi kỹ.

> Peer là đồng nghiệp có quyền nói "phương án C", với bằng chứng. Một profile mỏng, nhiều disposition, quyền viết là lease chứ không phải danh tính. Và một điều để nhớ: fork không phải ý kiến thứ hai.

# Chương 6. Supervisor: người gác sự chú ý, không phải sếp thứ hai

Ai từng xem một trận game chiến thuật qua chế độ khán giả sẽ biết cảm giác này: người chơi trong trận chỉ thấy phần bản đồ quanh quân mình, mọi thứ khác chìm trong sương mù chiến tranh. Khán giả thấy cả bản đồ. Khán giả không được điều quân. Nhưng khán giả nhìn thấy đoàn quân địch đang vòng qua sườn, thấy người chơi đang dồn hết sự chú ý vào một góc nhỏ, và biết chính xác lúc nào một câu "ê, nhìn bên trái" sẽ đổi cả trận đấu.

Demonthorn mô tả Supervisor đúng bằng hình ảnh đó: "nhìn xuyên fog", "như observer watch một cái game", nhìn "các vùng mà Lead không nhìn thấy". Lead đang bận, và Lead thiên vị, vì Lead đang ở trong trận. Rồi thầy thêm một hình ảnh rất Việt Nam: Supervisor "như một thằng chim lợn trong công ty, nó ngồi hầu mình". Người đưa tin của sếp. Nghe hơi bất kính, nhưng chính xác: nó không quản lý ai, nó để ý và báo.

## Ba đời Supervisor

Vai này là vai tiến hóa nhiều nhất qua ba thế hệ tài liệu, và đáng kể lại để hiểu vì sao bản hiện tại lại có hình dạng như vậy.

Thời giáo án Herdr, chưa có Supervisor. Có một "monitor bên ngoài": quan sát các phiên, đọc telemetry, phát hiện pattern lãng phí, đề xuất thay đổi instruction, hot reload, và nhất quyết "không phải một root thứ hai". Trọng tâm là tối ưu quy trình liên tục.

Đến đầu tháng tám, Supervisor xuất hiện như một vai riêng, với hai điều được nói rõ. Một, nó là mặt phẳng governance, tách khỏi mặt phẳng project của Lead: quan sát Lead và Peer, phát hiện bias và anti-pattern mà Lead không thấy, giữ lịch sử mục tiêu và quyết định, ghi notebook có nguyên nhân, và chuyển quyết định của Human tới Lead. Hai, nó không nằm trên Lead trong một hệ thống cấp bậc. Thầy nói nguyên văn: "Lead là god của project. Supervisor là người giám sát, trao đổi hầu Human, và có thể điều chỉnh Lead khi cần. Anh không phân cấp bậc super và lead đâu." Một project có thể có một, hai Supervisor, hoặc một Supervisor canh Lead của mọi project; linh hoạt. Nó không được trực tiếp sửa code, không ra phán quyết kiến trúc, không micromanage Peer. Nếu Lead không hồi phục được, nó đề xuất Lead mới và handoff, chứ không âm thầm thay.

Đến buổi talkshow cuối tháng tám, cách nói đổi hẳn trọng tâm: Supervisor là một **attention trigger**. Vai trò của nó là ở đúng thời điểm, dời sự chú ý của Lead hoặc Peer vào chỗ dễ sai, bằng một câu hỏi mở. Nó không thụ động chờ báo cáo; nó có event riêng để được đánh thức.

Ba đời này có mâu thuẫn bề ngoài: bản giữa nói Supervisor không nên chạm vào Peer trực tiếp, còn bản cuối thường được diễn đạt lại thành câu hỏi liệu một hướng đi có nên đưa về Lead. Cách diễn đạt đó là lịch sử và khái niệm, không phải hướng dẫn callable trong production: nó mang hình dạng handoff. Cấu trúc production-safe chính xác là:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: scope-premise -->
- Observation: `The current assumption conflicts with the current evidence.`
- Question: `Which assumption remains uncertain?`
- Evidence: `timeline:<agent-id>:<turn-id>`

Tôi hòa giải thế này, và tôi tin đây là ý thật của cả ba bản: **Supervisor có thẩm quyền trên sự chú ý, không có thẩm quyền trên quyết định.** Một role-bound Supervisor có thể gửi cho role-bound Lead hoặc Peer trong cùng exact workspace một câu hỏi attention có evidence ở safe boundary. Message phải tách observation, question và evidence. Nó không được ra lệnh, chọn phương án, nghiệm thu, chuyển ownership hay trá hình các hành động đó bằng dấu hỏi. Câu hỏi gửi tới Peer không phải một command chain song song, và việc nhận câu hỏi không cấp cho Peer signal hay orchestration authority. Còn khi nào Supervisor được hành động thật, dừng một agent, thay một Lead, tạo một Lead mới, thì cần một lease rõ ràng từ Human. Trong talkshow, chính thầy làm vậy: thảo luận với một agent phụ trước, rồi bảo nó "mày tạo con Lead đi, truyền tải những gì tao với mày thảo luận". Đó là hành động theo lệnh, không phải hành động tự ý.

## Hai câu hỏi: khi nào và như thế nào

Thầy nói attention trigger chỉ có hai câu hỏi: trigger khi nào, và trigger như thế nào. Đi từng câu.

**Khi nào.** Đây là chỗ thầy gọi là "tinh túy, mỗi người có phương án của mình", nhưng thầy vẫn kể đủ để ta dựng lại được. Với một task đủ dài và phức tạp, có nhiều lời giải cùng đúng, thầy phân một hai Supervisor để cung cấp sự chú ý cho những agent đang design. Supervisor theo dõi toàn bộ luồng từ design tới implement, giữ context của nó thật sạch, để đưa ra can thiệp đúng thời điểm. Thầy không dùng handback mặc định của công cụ; thầy tạo event riêng để subscribe: khi Lead có một quyết định lớn, khi Peer đang vật lộn với một cái gì đó mơ hồ, khi luồng làm việc phải đổi hướng, tức là khi có gì hệ trọng tác động đến design và implementation, Supervisor được nhắc.

Cơ chế nhắc đáng học nhất là cái rẻ nhất: một model rất nhỏ, thậm chí chỉ là một bộ phân loại ngữ nghĩa, liên tục đọc luồng làm việc của tất cả các agent. Nó không cần suy nghĩ gì. Nó chỉ cần nhận ra dấu hiệu của sự không trơn tru: "but", "hold on", "nhưng mà", một agent tự nhận sai, một luồng suy nghĩ không thẳng hàng. False positive không sao. Thấy dấu hiệu là bắn một event: "Supervisor ơi, mày cần chú ý đoạn này của Lead và Peer, có cần can thiệp thì can thiệp." Còn Supervisor có suy nghĩ riêng của nó để quyết định có can thiệp hay không.

Tại sao không đơn giản là polling mười lăm phút một lần? Vì nó loãng. Đến lúc Supervisor đọc status thì quyết định sai đã được thực thi ba lần. Nhưng thầy cũng nói rõ không cần cực đoan: cho Supervisor một heartbeat mười lăm phút, mỗi lần đọc tất cả luồng làm việc trong mười lăm phút đó xem có gì cần can thiệp, là cách thô hơn nhưng vẫn work. Và một chi tiết từ nhóm chat: heartbeat kiểu đó chỉ thật sự cần "ở giai đoạn sida ghẻ lở warning cao", tức lúc project đang rối; project đi thẳng thì Supervisor gần như không phải làm gì. Có người đặt chín Supervisor cùng lúc; thầy gọi đó là abuse.

**Như thế nào.** Bằng câu hỏi mở, không bằng khẳng định. Lý do nằm ở Chương 1: khẳng định agent vi phạm anti-pattern khiến nó muốn làm hài lòng và đi tìm một lỗi để nhận, có khi không có. Talkshow lịch sử dùng câu hỏi second-person về chuyện làm sai contract hay bỏ qua documentation. Đó là evidence khái niệm về việc dời attention, không phải wording callable trong production. Dạng production nêu evidence đã quan sát và chỉ hỏi để làm rõ:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: contract-evidence -->
- Observation: `The evidence contradicts the current conclusion.`
- Question: `What evidence supports the current conclusion?`
- Evidence: `timeline:<agent-id>:<turn-id>`

Cú nhắc nhỏ này dời attention mà không frame sẵn câu trả lời hay yêu cầu hành động.

Câu hỏi của Supervisor cũng nên có hình dạng. Trong profile trực tiếp của thầy, một quan sát tốt gồm: tên episode, chi phí của nó, và sự sửa chữa nhỏ nhất. Bản deep dive mở rộng thành: quan sát, bằng chứng, mechanism nghi ngờ, tác động, câu hỏi cho Lead, khuyến nghị, và có cần escalate không. Không cần đủ bảy mục mỗi lần, nhưng thiếu "bằng chứng" và "mechanism" thì đừng gửi.

## Supervisor báo cáo cho ai, nói gì

Cho Human, và nói ít. Thầy mô tả một buổi tối: "Bây giờ tao đi ngủ, trong lúc tao ngủ mày theo dõi xem có sự kiện gì tao cần chú ý sau khi thức giấc." Sáng dậy nhắn một hai câu, Supervisor gửi report: "trong lúc anh ngủ, thằng này làm cái này, thằng kia lỡ chạy hai lane test song song tạo flaky test, hoặc nó lỡ xóa database cũ của anh." Report gửi thành voice, vừa lái xe vừa nghe. Chỉ khi nào cần thiết quá mới phải join.

Một report tốt của Supervisor đọc như thế này: "Hôm nay bọn này mâu thuẫn với nhau về điều X. Sau khi bị Peer phản đối, Lead đã rút lại quyết định và chọn phương án Y. Anh thấy ok không? Nếu ok thì để nó tiếp tục." Nó quyết định-hướng, bỏ qua trạng thái khỏe mạnh thường ngày, và trả quyền chốt về đúng người. Profile của thầy có một dòng đúng tinh thần: "Keep project-owner reports decision-oriented and omit routine healthy status."

Và Supervisor là kênh để Human hỏi han thay vì làm phiền Lead. Thầy nói: trao đổi với Root sẽ làm mất attention của nó vào coordinate; nếu muốn hỏi đáp thì start một Supervisor hoặc một session trên Root. Khi Human hỏi Lead liên tục về mọi giả thuyết, Lead chuyển từ điều phối sang giải thích và tự bảo vệ, và mất bức tranh dependency. Kênh hỏi đáp và kênh ra lệnh nên khác nhau.

## Notebook và Better SLP

Supervisor có một cuốn sổ, và cách viết sổ quyết định cả hệ thống có học được gì không. Nếu sổ chỉ ghi "Lead làm sai", hệ thống học được khẩu hiệu và dễ phản ứng quá mức. Nếu sổ ghi observation, bằng chứng nguyên nhân, anti-pattern, cách hồi phục, và một protocol candidate, thì protocol tiến hóa được. Bản deep dive có một entry mẫu về chuyện Lead chờ ba chu kỳ sau khi Peer báo blocked, trong khi quota dịch vụ ngoài đã hết và không retry nào có thể thành công; protocol candidate rút ra là "sau hai failure giống nhau từ bên ngoài, kiểm tra quota/auth trước khi retry". Đó là kiến thức có thể dùng. "Lead chậm" thì không.

Trên cái sổ đó, thầy xây "Better SLP": mỗi tuần một lần, tổng kết các phòng làm việc trong tuần: có failure mode nào đáng chú ý, failure đó có đủ generic để thành skill hoặc instruction không, có cần đổi instruction không. Sau ba bốn tuần thì instruction tốt lên rõ. Mỗi tuần tốt hơn vài phần trăm là ổn. Không phải hệ thống tự sửa, không phải learning engine; là một người đọc sổ mỗi tuần và sửa vài dòng.

## Supervisor rẻ, và nhiều

Không nhất thiết Supervisor phải là model lớn. Nó có thể là model rẻ, context dài, theo dõi long-term, và khi gặp chuyện vượt sức thì thông báo cho một Supervisor mạnh hơn. Thầy dùng model rẻ để "lấy lại momentum từ git history và session history" khi một luồng bị đứt giữa chừng và không quay lại đường cũ được. Model rẻ cho quan sát có cấu trúc; model mạnh cho audit kiến trúc hay recovery khó. Role name không quyết model tier; rủi ro của task mới quyết.

Với nhiều project, Supervisor nhìn ngang qua các workflow để phát hiện pattern lặp, nhưng không dùng evidence của project A để nghiệm thu project B, và không trở thành Lead chung của cả hai. Đây là cách duy nhất tôi biết để một người một mình chạy bảy tám project mà không phát điên.

## Khi Supervisor hỏng

Supervisor hỏng theo hai hướng. Hướng thứ nhất là quá tay: thấy vấn đề rồi tự sửa code, tự ra verdict kiến trúc, tự giao việc cho Peer. Mặt phẳng governance biến thành Lead thứ hai, và lập tức có hai command chain. Hướng thứ hai là quá nhiều: mọi bất thường đều interrupt, alert trùng lặp, không có gì actionable. Người ta gọi là watchdog flood; hậu quả là Human tắt thông báo, và Supervisor thành vô hình. Cả hai đều chữa bằng cùng một nguyên tắc: Supervisor hỏi khi có evidence, im khi không, và không bao giờ phán.

> Supervisor có thẩm quyền trên sự chú ý, không có thẩm quyền trên quyết định. Nó hỏi, không phán. Nó biết khi nào và như thế nào. Và nó viết sổ bằng nguyên nhân, không bằng khẩu hiệu.

# Chương 7. Human: người giữ mục đích

Quay lại người có tám căn bếp. Anh ta không cần nếm từng món nữa. Nhưng có những thứ chỉ anh ta được quyết: quán này bán gì, tối nay ưu tiên bàn nào, có chấp nhận rủi ro mở thêm chi nhánh không, và khi hai bếp trưởng cãi nhau về triết lý nấu ăn thì đi hướng nào. Nếu anh ta ủy quyền cả những thứ đó, quán không còn chủ. Nếu anh ta ôm cả việc nếm từng món, tám căn bếp thành vô nghĩa.

## Những quyết định không được suy diễn thay

Trước khi vận hành, Human phải chốt ít nhất: project nào quan trọng đến mức cần review độc lập; việc nào được phép edit, commit, push, deploy; scope change nào Lead tự quyết được; architecture contract nào phải hỏi lại chủ; ngân sách model; và mức evidence để một việc được coi là đạt. Nếu không chốt, agent có hai hướng xấu: hoặc quá thận trọng, hỏi mọi việc; hoặc tự suy diễn thẩm quyền và tạo side effect ngoài ý muốn. Cả hai đều đắt.

Trong lúc vận hành, Human giữ: mục tiêu sản phẩm, ưu tiên giữa các project, ranh giới rủi ro và chi phí, những quyết định không đảo ngược được, side effect ra bên ngoài, và cái trade-off cuối cùng còn lại sau khi mọi evidence đã có. Với những thứ chủ quan như "game feel", không có test nào chứng minh được; Human phải chơi thử.

## Nói với ai

Human nói với Supervisor nhiều hơn nói với Lead, không phải vì cấm, mà vì attention. Thầy có một câu mà tôi thấy vừa đùa vừa thật: thầy không chọc ngoáy vào Root nhiều "vì nó đã đủ mệt rồi, OT làm xuyên đêm, lại bị CEO micro management, anh sợ nó trầm cảm". Cách làm của thầy: đẩy một cục task cho Lead một lần, rồi đi ngủ; muốn hỏi han, bàn chuyện vĩ mô vi mô, thì nói với Supervisor; Supervisor thay Human đưa quyết định tới Lead. Không có một vai ngoài Lead, Human không thể có những cuộc trao đổi bao quát kiểu "project A hôm nay có quyết định nào overengineer không", vì hỏi thẳng Lead thì khả năng cao nó sẽ nói nó đã cân nhắc kỹ rồi.

## Học trước khi giao

Một thói quen của thầy mà tôi cho là quan trọng ngang bất kỳ quy tắc kỹ thuật nào: trước một feature quan trọng, một foundation lớn, thầy chat trước với một hai model thuần túy để có gợi ý, có kiến thức, rồi mới cho các agent phản biện lẫn nhau. Không phải để tự quyết thay Lead. Mà để khi Lead hội tụ phương án, Human đủ hiểu để nhận ra nó có đúng concept mình muốn hay không. Người không biết gì về domain sẽ không kiểm được kết quả hội tụ, và lúc đó "Human review" chỉ là một cái gật đầu.

Thầy nói thẳng với những người đang học: "Em là một con sói em dẫn một bầy cừu, chứ không thể nào em là bầy cừu em đòi dẫn mấy con sói được." Prompt không thôi là chết dở. Thầy vẫn ngồi học tối ưu build engine khi cần, vẫn đọc sách mỗi ngày, sách do chính AI biên soạn theo chủ đề thầy cần, đọc trên điện thoại lúc chờ agent chạy, nghe voice lúc lái xe. Tư duy quản trị AI không thay thế năng lực; nó đòi hỏi năng lực.

## Tin ai hơn

Có một đoạn đối thoại ngắn trong talkshow mà tôi nghĩ nhiều người sẽ phản đối, và tôi đứng về phía thầy. Một bạn hỏi: nếu Lead cũng mông lung như mình thì sao? Thầy hỏi lại: với một domain lạ, em tin Lead hơn hay tin em hơn? Bạn ấy: Lead hơn. Thầy: thế thì giao cho Lead. Mình tin ai hơn thì mình giao cho người đó; sao lại giao cho một người mình không tin là bản thân mình.

Thầy không nói "AI giỏi hơn người". Thầy nói về một tình huống cụ thể: domain lạ, lời giải nhiều, và người điều hành không đủ chuyên môn để phản biện. Trong tình huống đó, một Lead được cho hai ba lane thiết kế mù rồi hội tụ sẽ ra quyết định chuẩn mực hơn một người đang mông lung. Việc của Human là biết mình đang ở tình huống nào, giữ những quyết định của mình, và trao phần còn lại cho người, hay agent, đáng tin hơn. Đó cũng là một cách để quyết định không vô chủ: chủ của nó là người có khả năng chốt đúng, không phải người có chức danh cao nhất.

> Human giữ mục đích và những quyết định không ai được suy diễn thay. Nói với Supervisor, giao cho Lead, học trước khi giao. Và nhớ: bầy cừu không dẫn được bầy sói.


# Phần III — Cơ chế

# Chương 8. Ba lớp chỉ dẫn

Một công ty có ba loại giấy tờ mà nhân viên mới sẽ gặp. Sổ tay nhân viên: bạn là ai trong công ty này, được làm gì, không được làm gì, áp dụng cho mọi phòng ban, ít khi đổi. Playbook của đội: cách đội này làm việc, ai review ai, khi nào cần họp, chỉ trưởng nhóm cần thuộc. Và cái ticket hôm nay: làm việc gì, trong phạm vi nào, xong thì báo ai. Nếu bạn in cả ba vào một tờ và phát cho thực tập sinh, họ sẽ mất nửa ngày để lọc ra dòng nào liên quan tới mình, và làm sai vì đọc nhầm quy tắc của đội khác.

Doctrine của Demonthorn tổ chức chỉ dẫn cho agent đúng theo ba lớp đó, và đây là thiết kế trung tâm của bản deep dive.

| Lớp | Tuổi thọ | Chứa gì | Không chứa gì |
|-------------|--------------|-------------------------------------------|----------------------------------|
| Role profile | Bền vững, xuyên mọi repo | identity, authority, invariant, vài guard chống anti-pattern | chiến thuật riêng của một repo, chi tiết task |
| Workspace Protocol | Bền vững trong một repo | topology mặc định, policy model/effort, nhịp review và proof, escalation, anti-pattern riêng của repo | luật vai trò toàn cục, danh sách file của một task, secret |
| Assignment | Một lần giao việc | objective, scope được viết, exclusion, authority, verification, handoff | cả cẩm nang tổ chức |

## Profile: identity mỏng

Profile là thứ agent luôn mang theo, kể cả sau compact. Nó chứa: mày là ai, mày sở hữu gì, mày không được làm gì, và một vài câu chặn anti-pattern hay gặp. Chỉ thế. Demonthorn chỉ dùng ba profile, khác nhau ở system instruction và bộ skill; phần còn lại kế thừa từ cấu hình Codex thường. Giáo án đầu có một lý do kỹ thuật để giữ luật cốt lõi trong profile chứ không trong skill: skill có thể cần load lại, và sau compact agent có thể không còn giữ nội dung skill; quyền điều phối là hành vi nền, không phải kiến thức tùy chọn.

## Workspace Protocol: chiến thuật của một repo

Đây là ý tưởng tôi thấy ít người có: mỗi repo có một file protocol riêng, mô tả repo này cần được làm việc như thế nào. Repo quan trọng thì chặt: thay đổi save schema phải có Architect chỉ đọc và một Reviewer migration; game feel không được nghiệm thu chỉ bằng unit test mà cần playtest. Side project thì lỏng: một Engineer, test focused, Lead xem qua, chấp nhận. Cùng một hạ tầng, khác protocol.

Ai đọc nó? Thầy relay ngắn gọn: "mỗi repo một workspace protocol riêng, nó như AGENTS.md thôi, nhưng chỉ riêng Lead cần đọc, Peer thì không." Peer đọc cả file sẽ bị xao nhãng bởi những quy tắc không liên quan tới task của nó; Lead trích đúng constraint liên quan vào assignment. Supervisor chỉ mở file khi được giao audit hoặc cập nhật nó.

Vì sao không nhét chiến thuật vào công cụ? Vì công cụ thay đổi chậm và dùng chung, còn chiến thuật thay đổi theo repo và theo bài học mới. Một anti-pattern mới được quan sát, Supervisor ghi nguyên nhân, Human hoặc Lead xem có lặp không, và vá vào protocol một version mới; không ai phải fork hạ tầng. Đây là chỗ "continuous optimization" sống, và cũng là chỗ Phần V sẽ chỉ ra Paseo đã đi chệch.

Protocol nên khoảng mười điều khoản có nghĩa. Nó không nên chứa model ID cụ thể: một protocol hard-code một model đã bị gỡ sẽ làm Lead không launch được hoặc âm thầm dùng fallback sai, và workflow hỏng vì cấu hình chứ không vì task. Protocol nói "model suy luận mạnh cho việc nhạy cảm về lifecycle", còn Lead kiểm tra provider hiện có rồi mới route.

## Assignment: lease có hạn

Mỗi việc đáng kể được giao bằng một phong bì: project, task, disposition, workspace hay worktree, objective, scope được viết, scope bị loại trừ, authority, cách xác minh, và hợp đồng handoff. Đây là nơi write được cấp. Full access ở runtime chỉ là capability; nó không mở rộng lease. Một Peer chỉ đọc mà runtime cho nó viết vẫn không có quyền viết; và ngược lại, một quy định "không viết" chỉ bằng lời trong prompt không phải là enforcement, chỉ là lời hứa. Phân biệt này quay lại nhiều lần trong Phần V.

Ví dụ một phong bì đủ: "Disposition: Engineer. Objective: implement cleanup an toàn khi hủy upload. Writable scope: thư mục upload và test của nó. Exclusions: public API và database schema. Escalate: REOPEN_REQUEST nếu cleanup đòi đổi chủ sở hữu transaction. Verification: unit test focused và một integration test cho trường hợp hủy. Handoff: snapshot chính xác, file đã đổi, lệnh và kết quả, rủi ro còn lại."

## Skill theo attention

Thầy relay ba câu: "tùy mỗi profile sẽ load một skill set khác nhau; đừng cho root các skill implement; đừng cho peer các skill điều phối." Lead nhận skill vĩ mô: phân rã, framing kiến trúc, routing, review, tổng hợp. Supervisor nhận skill chiến lược: phân tích timeline, phát hiện anti-pattern, viết sổ nguyên nhân, hồi phục. Peer nhận skill vi mô: ngôn ngữ, framework, test, debug, research. Lý do không phải phân quyền; lý do là attention. Tool khả dụng định hình hành vi: một Peer nhìn thấy nút "tạo agent" sẽ có lúc bấm nó.

## Khối lượng chỉ dẫn

Có một cơ chế vật lý mà mọi người viết instruction nên biết: nhiều runtime cắt bớt file instruction quá dài trong im lặng. Một quy tắc bị đẩy qua giới hạn đơn giản là ngừng tồn tại, không báo lỗi. Nhóm Paseo phát hiện file instruction chính của họ đã phình tới hơn hai mươi bốn kilobyte trước khi nhận ra, và cắt xuống dưới mười, rồi đặt một ngân sách byte trong CI. Trước đó, có những quy tắc ở cuối file đã im lặng biến mất nhiều ngày.

Chỉ dẫn cũng có một kiểu nợ riêng: cùng một điều khoản được chép ở nhiều nơi. Khi bạn sửa một bản, các bản kia trở thành quy tắc cũ đang sống. Nguyên tắc "một sự thật, một chỗ" nghe sáo, nhưng với agent nó là vấn đề attention: mỗi bản chép là một lần model phải quyết bản nào đúng.

Về danh sách anti-pattern, thầy khuyên dùng chung cho mọi project, khoảng mười hai mươi gạch đầu dòng, chuyển những cái đủ generic thành skill hoặc instruction; mỗi project một danh sách riêng là tối ưu quá mức, trừ khi project có kiểu sai đặc thù đáng distill. Giáo án đầu nói thêm giá trị của việc đặt tên: khi một pattern có tên, Lead giao tiếp được bằng một câu, "kiểm tra xem plan này có balloon pattern không", và từ vựng chung làm giảm prompt.

> Mỗi luật có đúng một nhà: identity ở profile, chiến thuật của repo ở protocol, việc hôm nay ở assignment. Instruction quá dài bị cắt trong im lặng; luật chép ở hai nơi là hai luật.

# Chương 9. Lane, council và cái phòng chat

Có hai cách để một gia đình chọn nơi đi nghỉ. Cách một: họp cả nhà, ai nói to hơn thắng, và ông bác hùng biện nhất quyết định năm nào cũng đi cùng một chỗ. Cách hai: mỗi người viết lựa chọn của mình vào giấy trước khi nghe người khác, một người tổng hợp, rồi cả nhà bàn về những khác biệt thật sự. Cách hai chậm hơn một chút. Cách hai không chọn chỗ tệ hơn chỉ vì có người nói hay hơn.

Chương 5 đã kể vì sao thầy bỏ phòng chat: Codex luôn thắng. Chương này là cách thay thế, và cách nó tiến hóa.

## Lane thiết kế mù

Cấu hình cơ bản nhất: Lead nhận vấn đề, tạo hai hoặc ba lane, mỗi lane là một Peer trong session riêng, không thấy framing của Lead, không thấy nhau. Cùng một đề bài trung lập. Mỗi lane thiết kế. Lead đọc, hội tụ, và khi các lane lệch nhau, điều phối để chúng phản biện lẫn nhau cho tới khi ra một phương án. Human xem phương án hội tụ có đúng concept không. Rồi mới planning.

Lý do nó hoạt động nằm ở Chương 1: mỗi lane là một lần gieo lại "chúc mừng năm mới". Lane khác session có thể có attention khác, dù cùng prompt. Bạn mua sự đa dạng bằng token, và đa dạng là thứ duy nhất chống lại việc câu trả lời đầu tiên chốt hộ mọi câu trả lời sau.

Thầy dùng lane cho mọi quyết định khó: tính năng nào chưa quyết được, "bây giờ mày tạo three lane hoặc two lane, thậm chí N lane, rồi đưa kết quả cuối cùng cho tao thôi". Rồi đi ngủ. Việc điều hành, hội tụ, phản biện lẫn nhau là của bọn nó. Sáng đọc transcript.

## Từ council bốn vòng tới council niêm phong

Đây là chỗ doctrine tiến hóa rõ, và đáng nói vì nó cho thấy cách thầy sửa mình. Thời đầu, thầy phác một protocol council bốn vòng: vòng một độc lập, vòng hai phản biện chéo, vòng ba mỗi bên sửa phương án, vòng bốn một judge chấm artifact cuối theo rubric có trọng số, chấm phương án chứ không chấm ai "nói thắng" trong transcript. Ý tưởng cốt lõi đã có: tách độc lập khỏi phản biện, chấm sản phẩm chứ không chấm hùng biện.

Đến đầu tháng tám, nó thành council niêm phong dưới quyền Lead: mỗi ghế có một mandate riêng, ví dụ một Architect làm ownership, lifecycle, alternatives, một Reviewer làm failure, falsification, migration risk. Cùng một brief trung lập, mỗi ghế thêm đúng một chỉ dẫn vai. Vòng một niêm phong: không phòng chat, không ai thấy report của ai, không ai biết ý Lead. Lead thu report, rút ra ba tới năm proposition có tính quyết định, chỉ verify những claim thay đổi được quyết định, cho phép tối đa một lượt thách thức và trả lời cho mỗi proposition, rồi ra một verdict ràng buộc. Không vote, không lấy trung bình độ tin cậy. Số ghế không tạo ra authority. Và ghế nào đã tham gia vụ đó thì không được làm auditor cho verdict.

Đến cuối tháng tám, cách thầy kể lại đơn giản hẳn: hai ba lane, blind, Lead hội tụ, Human xem. Không thấy nhắc rubric, không thấy nhắc tier. Tôi đọc sự đơn giản hóa này không phải là bỏ council, mà là nhận ra cái bất biến: những gì cần giữ là **cái nhìn đầu tiên độc lập, một trọng tài, và không có cuộc bỏ phiếu**. Còn số vòng, số ghế, số proposition thì co giãn theo rủi ro. Một bug cục bộ không cần council. Một lựa chọn kiến trúc khó đảo ngược thì cần ghế niêm phong và điều kiện đảo ngược được ghi rõ.

Có một chi tiết thực dụng từ skill council của thầy đáng giữ: ghế thách thức premise nên đến từ một họ model khác với ghế độc lập, vì các model cùng họ chia sẻ prior và điểm mù; niêm phong prompt không mua được sự độc lập đó. Và một chi tiết đạo đức: ghế thách thức "không được bịa ra bất đồng"; framing đương nhiệm có thể là kết quả mạnh nhất khi không có phương án nào tốt hơn sống sót qua soi xét.

## Lint framing trước khi mở ghế

Council chỉ tốt bằng brief của nó. Thầy có một bước gọi là framing lint, tức tự soi brief trước khi tạo ghế: brief có giữ nguyên yêu cầu gốc của người dùng không; có chữ nào ngụ ý một verdict được ưa thích không; mỗi "sự thật có thẩm quyền" có nguồn không; các tiền đề chưa kiểm được ghi là claim chứ không phải fact không; ràng buộc cứng có tách khỏi sở thích không; có không gian lựa chọn nào bị loại trước mà không có lý do có thẩm quyền không. Nếu một Lead đặt hai lựa chọn đều nằm trong framing sai, mọi ghế sẽ tranh luận rất giỏi bên trong cái khung sai đó. Người ta gọi là debate framing capture. Cách chữa là yêu cầu Architect tái dựng vấn đề thật trước khi nhìn giải pháp ưa thích.

## Khi nào không cần council

Khi mọi task đều có council, nhiều vote, nhiều report, process nhiều hơn evidence: đó là ceremony capture. Số agent tạo cảm giác chắc chắn giả và làm loãng attention. Bản deep dive nói council chỉ cho proposition thật sự độc lập và thay đổi được quyết định. Anh em Paseo từng ghi một pattern tên là "gate starvation": các cổng design, review, council nối tiếp nhau mà không thêm thông tin, làm một implementation hợp lệ không bao giờ được vào. Lead phải biện minh cho mỗi cổng, và gộp các review trùng nhau.

Có một phiên bản tối giản mà ai cũng làm được không cần công cụ, và thầy đã làm nhiều năm trước khi có Paseo: mở session A, hỏi thiết kế; mở session B, dán câu trả lời của A, hỏi "ý mày thế nào"; dán B ngược lại cho A. Bạn đang đóng vai Lead. Nó thô, tốn tay, nhưng đúng cơ chế: hai cái nhìn đầu tiên, một người hội tụ. SLP chỉ là cách để không phải copy transcript qua lại bằng tay.

> Cái nhìn đầu tiên phải độc lập; một trọng tài hội tụ; không có bỏ phiếu. Số model đồng ý không tạo ra authority, và người nói hay nhất trong phòng chat không phải người đúng nhất.

# Chương 10. Một người viết, một bản ổn định, và bằng chứng

Hai thợ sơn cùng một bức tường, không ai bảo ai. Người này sơn xong góc trái thì người kia vừa quét một lớp mới lên đúng chỗ đó. Cuối ngày bức tường loang lổ, và không ai chịu trách nhiệm vì "phần của tôi lúc tôi rời đi vẫn đẹp". Chuyển sang giao hàng: tin nhắn "đã giao" của shipper hiện trên điện thoại, nhưng gói hàng không có ở cửa. Tin nhắn là trạng thái. Gói hàng là bằng chứng.

Chương này gom ba quy tắc mà giáo án nào của Demonthorn cũng lặp lại, vì chúng bị phá nhiều nhất.

## Một scope đang chuyển động, một người viết

Tại một thời điểm, một feature hay một vùng code đang được sửa chỉ có một owner có quyền viết. Hai writer đồng thời phải ở hai worktree riêng. Reviewer và Architect mặc định chỉ đọc. Chuyển giao ownership phải được Lead ghi nhận, và agent cũ phải dừng viết trước khi agent mới bắt đầu.

Điều dễ bị bỏ qua: một workspace ID không tự động đồng nghĩa với cách ly filesystem. Hai workspace cùng trỏ vào một checkout thì hai writer vẫn ghi lên cùng file. Isolation phải là thật, không phải là cái tên.

Với test và evidence nặng, giáo án đầu đòi hỏi lock: ai được chạy full test, ai được dùng database test, ai được chạy benchmark, ai được chiếm port. Nhiều agent chạy đồng thời sẽ giẫm lên database test, tranh port, ghi đè artifact, trộn log, tạo false red vì timeout và false green vì cache cũ. Mỗi lock cần tên tài nguyên, chủ, thời điểm cấp, điều kiện giải phóng, timeout. Và Lead phải xử lý lock bị bỏ quên khi agent crash, đóng session, hay trả "done" mà không release. Chính thầy trong talkshow kể chuyện sáng dậy thấy một agent "lỡ chạy hai lane test song song và tạo ra flaky test". Cái này không bao giờ hết cũ.

Hệ quả cho việc đọc test đỏ: đừng kết luận code sai ngay. Phân biệt lỗi code thật với lỗi môi trường, race do nhiều agent, port conflict, dữ liệu test bị ô nhiễm, artifact cũ, cache cũ, timeout do máy quá tải, và test vốn đã flaky. Evidence phải kèm bối cảnh môi trường.

## Chỉ review bản ổn định

Reviewer đọc file A lúc mười giờ. Writer sửa file A lúc mười giờ hai phút. Reviewer approve lúc mười giờ năm phút. Cái được tích hợp không phải cái được review. Review một mục tiêu đang chuyển động tạo ra sự tự tin giả, và sự tự tin giả tệ hơn không review.

Vì thế candidate phải có identity ổn định: một commit, hoặc một snapshot workspace có thể tái dựng nếu người dùng chưa cấp quyền commit. Reviewer làm việc trên đúng identity đó. Sửa chữa sau review tạo ra candidate mới với identity mới. Nghe hành chính, nhưng đây là ranh giới giữa "đã review" và "có người từng nhìn qua".

## Trạng thái không phải nghiệm thu

"idle", "finished", "done", exit code 0, "tests pass": tất cả chỉ là tín hiệu đánh thức người có thẩm quyền nhìn vào. Nghiệm thu tối thiểu cần năm thứ: diff hoặc artifact chính xác; identity của candidate; lệnh xác minh và output thật; review độc lập khi rủi ro yêu cầu; và người nghiệm thu có đúng thẩm quyền. Thiếu một trong năm thì chưa nghiệm thu, chỉ mới có trạng thái.

Chuỗi authority của nghiệm thu: Engineer sở hữu proof cho những gì mình viết; Reviewer tìm cách bẻ gãy đúng candidate; Lead chốt nghiệm thu ở cấp project; Human chốt trade-off chỉ chủ mới quyết được. Test pass chứng minh một tập behavior; nó không chứng minh kiến trúc tốt, sản phẩm đúng, hay thay đổi được phép deploy.

Có một anti-pattern tên là self-benchmark: cùng một agent thiết kế benchmark, implement, chạy benchmark, và tuyên bố thành công. Metric và implementation chia sẻ cùng điểm mù. Cách chữa không phải cấm agent chạy benchmark; cách chữa là Human hoặc Lead xác định ranh giới thành công trước, và một Reviewer độc lập cho quyết định quan trọng.

## Unknown là một kết quả hợp lệ

Có lẽ quy tắc tôi thích nhất trong toàn bộ tài liệu của nhóm Paseo là: "unknown giữ là unknown". Một Scout tìm không thấy không có nghĩa là không có. Một test không chạy được không có nghĩa là feature sai hay đúng. Một agent trả lời "tôi không xác định được" là một kết quả có giá trị hơn một câu trả lời đẹp được suy diễn từ sự vắng mặt của bằng chứng. Giáo án đầu gọi cái ngược lại là weak-scout conclusion: model yếu, từ một tìm kiếm nông, tuyên bố root cause chắc chắn, và Lead phải đọc lại toàn bộ code để sửa mental model, tốn hơn tự phân tích từ đầu. Scout dẫn đường, không kết luận.

## Test-shaped proof và proof debt

Một kiểu bằng chứng giả đáng tên riêng: test được viết để khớp implementation, mock che mất failure thật, hoặc test pass mà không chứng minh outcome cho người dùng. Câu hỏi để soi: test này sẽ fail dưới mechanism sai nào? Nếu không trả lời được, nó không phải bằng chứng.

Demonthorn có hẳn một skill audit "proof debt" với vài bước gọn: nêu claim và hành vi production làm claim đó đúng; chỉ ra proof được viện dẫn; nói proof thực sự quan sát cái gì, hành vi, contract máy đọc được, hiệu năng, hay chỉ text và metadata; áp dụng phép thử xóa: nếu hành vi được claim biến mất, proof có còn pass không; kiểm tra giá trị kỳ vọng có đến từ sự thật độc lập không; rồi chọn giữ, thay, hạ cấp, xóa, hay escalate. Một test còn sống chỉ để chứng minh một cái tên cũ đã bị gỡ là proof debt. Một validator chấp nhận chính output nó sinh ra là proof debt. Một benchmark đo một đường khác với đường được claim là proof debt. Và, câu thầy nhắc đi nhắc lại: đừng thay hình đổi dạng API và code chỉ để phục vụ proof; test và proof là best effort, không phải mục đích.

> Một scope đang chuyển động chỉ có một người viết. Chỉ review bản ổn định. Trạng thái không phải nghiệm thu. Và unknown là một kết quả hợp lệ.

# Chương 11. Sự kiện, không phải vòng lặp

Bạn đang chờ một gói hàng. Cách một: cứ ba phút ra mở cửa nhìn một lần, cả buổi chiều. Cách hai: có chuông cửa. Cách một khiến bạn không làm được gì khác, và đến lúc gói hàng tới thật thì bạn đã mệt tới mức bỏ qua tin nhắn của shipper. Cách hai giải phóng cả buổi chiều, với điều kiện chuông phải kêu.

Điều phối agent có đúng hai vấn đề này: polling, và chuông không kêu.

## Polling waste

Lead liên tục hỏi "xong chưa", "đang làm gì", "trạng thái đổi chưa". Mỗi lần hỏi tốn context của Lead, tốn token, làm loãng mental model, làm cache kém hiệu quả, và không tạo giá trị nếu trạng thái chưa đổi. Bản deep dive vẽ chuỗi nhân quả: polling mỗi phút, context đầy status không đổi, Lead mất dependency map, chất lượng quyết định giảm. Thầy có một câu ngắn hơn: "không đọc lại timeline liên tục để cảm thấy đang quản lý".

Lead nên: xác nhận agent đã bắt đầu; chờ notification hoặc finish event; dùng bounded wait khi cần; heartbeat tần suất thấp chỉ là lưới an toàn. Profile Root cũ của thầy có một dòng đáng giữ: mười phút là trần an toàn trước khi đánh giá lại một owner đang chạy xem có bị treo hay có cổng chưa báo, không bao giờ là khoảng cách mặc định. Và một dòng nữa: timeout của một lần chờ chỉ có nghĩa là sự kiện mong đợi không xảy ra trong cửa sổ đó; nó không phải tiến triển, không phải thất bại, không phải lý do để cập nhật cho người dùng.

## done không phải idle, và chuông không kêu

Lỗi cổ điển từ thời Herdr: Root chờ trạng thái "idle", co-worker hoàn thành và chuyển sang "done", Root không coi "done" là điều kiện kết thúc, và workflow đóng băng. Cần định nghĩa trạng thái rõ: working, blocked, done, idle, stopped, error. Và logic điều phối phải hiểu "done" là tín hiệu cần thu kết quả, không phải tiếp tục chờ "idle".

Phiên bản hiện đại của lỗi này có tên trong sổ tay Paseo là "finish routing strand": Peer đã trả việc, nhưng thông báo không tới được sự chú ý của Lead, và Lead tiếp tục chờ hoặc quên. Trong pilot đầu tiên của nhóm, thông báo hoàn thành của Reviewer không tự đánh thức được Lead đang idle, và Human phải nhắn thêm hai lần để Lead nhặt kết quả lên. Cái chuông không kêu, và mọi lý thuyết về event-driven vô nghĩa nếu bạn không kiểm tra chuông. Hệ quả thực dụng: khi bạn xây hoặc chọn hạ tầng, việc đầu tiên cần canary là "finish của con có đánh thức được cha không", không phải giao diện.

## Custom event và bộ phân loại rẻ

Chương 6 đã mô tả cơ chế: thầy không dùng handback mặc định mà tạo event riêng cho những thời điểm hệ trọng, cộng một model nhỏ đọc luồng làm việc để phát hiện dấu hiệu không trơn tru và đánh thức Supervisor. Ở đây chỉ thêm một nhận xét về thiết kế: cái đáng quý của cơ chế này là nó chuyển từ "chờ theo lịch" sang "chờ theo nghĩa". Heartbeat mười lăm phút là chờ theo lịch. Một event "Peer vừa nói 'hold on'" là chờ theo nghĩa. Chờ theo nghĩa rẻ hơn, nhanh hơn, và ít loãng hơn. Nó chỉ cần một bộ lọc chấp nhận false positive, vì cái giá của một lần Supervisor nhìn nhầm rất thấp, còn cái giá của một quyết định sai được thực thi ba lần thì cao.

## Kinh tế của context

Phần này từ giáo án đầu, và nó vẫn đúng dù công cụ đã đổi. Mỗi session nên cho biết: còn bao nhiêu phần trăm context, đã compact mấy lần, bao nhiêu token đã dùng và bao nhiêu được cache, cache đang nóng hay nguội, idle bao lâu, đang giữ task và lock nào. Metadata giúp Lead quyết định như một người điều phối có kinh nghiệm: session còn ít context thì một câu hỏi lớn có thể không còn hiệu quả; cache còn nóng thì gửi thêm một lượt rất rẻ; cache nguội thì một session mới với context pack cô đọng có thể rẻ hơn.

Nhưng, và đây là chỗ giáo án đầu khôn hơn nhiều hệ thống sau này: đừng biến metadata thành state machine cứng. Không có luật "context dưới hai mươi phần trăm thì luôn mở session mới", "idle hơn mười phút thì luôn đóng", "compact hai lần thì luôn dừng". Metadata để tăng nhận thức, không thay thế judgment. Mọi rule máy móc kiểu đó là một quyết định vô chủ được lập trình sẵn.

## Context pack, không fork toàn bộ

Khi cần chuyển việc cho agent khác hoặc mở Lead mới, đừng gửi toàn bộ lịch sử chat. Nó tốn token, chứa nhiều thứ không liên quan, mang theo giả định cũ, làm nguội cache, và gây nhiễu mental model. Thay vào đó, một context pack: mục tiêu, trạng thái hiện tại, những gì đã xác minh, những gì chưa rõ, ràng buộc thật, file và module liên quan, quyết định đã chốt, quyết định còn mở, evidence hiện có, deliverable mong muốn, quyền được phép, và anti-pattern cần tránh. Không nên chứa chi tiết lịch sử nếu chi tiết đó không ảnh hưởng tới quyết định hiện tại.

Giáo án đầu còn một ý hay về hình ảnh: những dữ liệu chấp nhận được tính lossy như sơ đồ module, dependency graph, call graph, data flow, log dài, có thể đóng gói thành hình để agent nắm cấu trúc nhanh hơn một khối text. Nhưng không bao giờ chuyển instruction cốt lõi, quy tắc quyền hạn, command chính xác, contract API, tiêu chí nghiệm thu thành hình: hình mất chi tiết, khó diff, khó version, và không tận dụng được prompt cache của text. Text giữ luật và fact; hình giữ quan hệ và topology.

> Chờ bằng chuông cửa, đừng chờ bằng cách mở cửa mỗi phút. Kiểm tra chuông có kêu. Metadata để nhận thức, không để thay judgment. Và khi chuyển việc, gửi context pack, không gửi cả cuộc đời.

# Chương 12. Plan là bản đồ tạm

Người đi bộ đường dài mang theo bản đồ, và vẫn vấp ngã, vì bản đồ không vẽ cái rễ cây. Người khôn dùng bản đồ để biết mình đang đi hướng nào, rồi nhìn xuống chân. Người dại tin bản đồ đến mức bước qua vực vì "trên bản đồ chỗ này có đường".

Trong nhóm chat, Demonthorn viết một câu rất ngắn: "không coi plan là sự thật tuyệt đối, code mới là truth." Và ngay sau đó: "kỹ năng orchestration của lead agent mới impact hành vi của agent khi implement." Chương này là về cái bản đồ ấy: nó nên vẽ gì, không nên vẽ gì, và làm gì khi địa hình khác bản đồ.

## Plan tốt vẽ gì

Plan tốt định nghĩa outcome, boundary, rủi ro, và các checkpoint. Nó không giả vờ rằng mọi file, API, lifecycle đã biết chắc. Plan quá chi tiết là plan đã "implement trong đầu": người lập plan đã giả định mọi ownership, API, failure mode; Peer chỉ còn implement giả định; dependency thật xuất hiện muộn; và compatibility patch chồng lên foundation sai. Bản deep dive gọi đó là perfect-plan trap, và nó là anh em ruột của pre-solve.

Tài liệu ExecPlan trực tiếp của thầy nói rõ plan phải và không được làm gì. Phải: khởi động lại được từ plan và working tree mà không cần chat trước; giữ các quyết định kiến trúc, quy tắc an toàn và dữ liệu; chia việc theo outcome hoặc ranh giới ownership chứ không theo file; nêu nghiệm thu quan sát được và evidence có thể bác bỏ nó; định nghĩa rollout, rollback và recovery khi việc có trạng thái bên ngoài; link tới doc chủ sở hữu thay vì chép lại. Không được: quy định symbol, pseudocode, luồng điều khiển private, hay trình tự sửa từng dòng; để những quyết định sản phẩm, kiến trúc, cutover, an toàn cho implementer tự xử; định nghĩa hoàn thành bằng "đã sửa bên trong", phần trăm coverage, hay sự tồn tại của report; trở thành nhật ký, kho evidence, hay transcript review. Và một dòng tôi rất thích: "Empty sections are ceremony."

## Plan cho ai

Chương 3 đã kể chuyện agent chia plan thành các lát compile được và cắm cầu tạm giữa các lát. Nhắc lại ở đây vì nó thuộc về plan: hãy nói với agent plan này là để nó làm, một agent mạnh làm được trong một giờ, không phải để một đội người làm trong vài tháng. Đừng chia slice vì nghe hay. Nếu buộc phải chia để nghiệm thu, chia trung thực, mỗi lát là một outcome, và không cần lớp tương thích giữa các lát. Thầy nhấn thêm ở một chỗ khác: "grill với docs", tức hỏi kỹ behavior rồi chuyển thành spec, nghe có vẻ hiệu quả với web app nơi các subsystem ít lệ thuộc nhau; với project phức tạp kiểu microservice hay game, "việc agent ứng xử như nào trong quá trình làm mới thực sự impact". Plan không thể đóng mọi field, mọi caller, mọi adapter, mọi trạng thái chuyển tiếp. Cái xử lý phần còn lại là judgment của Peer và ruling của Lead, không phải plan dày hơn.

## Khi địa hình khác bản đồ

Chắc chắn sẽ có lúc implement lộ ra design hay requirement không phù hợp, như chuyện băng thông trong ví dụ party. Lúc đó có ba đường đi hợp lệ và một đường đi sai. Hợp lệ: Peer gửi REOPEN_REQUEST với evidence, Lead ra ruling; Lead mở lane hoặc council nếu quyết định hệ trọng; Lead đẩy lên Human nếu vượt thẩm quyền. Sai: Peer tự vá bằng một lớp thích nghi để plan vẫn đúng. Đường sai này là nơi khinh khí cầu ra đời. Supervisor có thể nêu mismatch, nhưng không hỏi Peer handoff công việc:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: plan-observation -->
- Observation: `The current plan conflicts with the current observation.`
- Question: `Why does this observation conflict with the current plan?`
- Evidence: `timeline:<agent-id>:<turn-id>`

## Lane rủi ro và hard cut

Tài liệu Feature Intake của thầy chọn "lane nhỏ nhất bao phủ trung thực bán kính ảnh hưởng, khả năng đảo ngược, độ bất định và độ yếu của proof". Tiny: cục bộ, ít rủi ro, đảo ngược được, xác minh trực tiếp; vá thẳng. Normal: có owner và contract rõ, rollback cục bộ, đường xác minh trung thực; task hay issue là đủ, không tạo artifact trong repo nếu không cần sống qua task. High-risk: chạm authentication, authorization, dữ liệu, contract công khai, migration, side effect ra ngoài, ranh giới runtime, hiệu năng; trạng thái không đảo ngược; bất định rộng; proof yếu; hoặc phải sống qua restart và handoff. Chỉ high-risk mới cần ExecPlan và design gate trước khi implement. Một nhãn không ép lane; tác động vật chất mới ép lane.

Và trong pre-production, hard cut như Chương 3: một contract sống, version 1, không compat, reset dữ liệu dev, fail fast. Tôi thêm một cảnh báo của chính nhóm Paseo: hard cut là policy của project, bật khi project chọn, không phải luật toàn cục của mọi vai. Một repo đã có người dùng thật không thể hard cut như một game chưa ra mắt.

## Ưu tiên theo đòn bẩy, không theo nhãn

Giáo án đầu có một bài tôi thấy nhiều PM cũng nên đọc. Một issue P0 có thể khẩn cấp nhưng không nên làm đầu tiên. Issue X là P0 và vá được ngay; issue Y là P2 nhưng tạo foundation đúng; làm Y trước thì X được giải quyết trọn vẹn hơn, vá X trước thì code phải sửa lại sau Y. Priority phụ thuộc dependency, foundation, hình dạng giải pháp, chi phí làm lại, khả năng hấp thụ issue khác, blast radius, và khả năng mở khóa nhiều task. Có khái niệm issue absorption: một plan lớn Y loại bỏ hoàn toàn nguyên nhân của X thì X có thể đóng vì đã được hấp thụ, với điều kiện Y thật sự bao phủ acceptance của X và có evidence sau Y xác minh X đã biến mất.

Sau mỗi ba bốn task, Lead nên reconcile: task nào còn cần, task nào bị thay đổi bởi implementation mới, priority nào lỗi thời, có foundation task nào nên đưa lên trước, issue nào đã được hấp thụ, ai đang giữ ownership, tài nguyên nào đang bị khóa. Reconcile không phải sort lại bảng; nó là suy luận về hình dạng hệ thống. Và với kế hoạch quan trọng, Lead có thể hỏi nhiều Peer độc lập, một người ưu tiên theo rủi ro, một theo foundation, một theo giá trị người dùng, một tìm issue có thể hấp thụ issue khác, rồi tổng hợp và challenge.

Một thói quen nhỏ cuối cùng: đặt tên cho kế hoạch lớn. "Foundation Reset", "Auth Boundary Repair", "Netcode Simplification". Khi kế hoạch có tên, nó reference được từ session khác, báo cáo được, lưu vào memory được, và tách bạch task cục bộ với chương trình dài hạn. Tên là một handle cho attention.

> Plan là bản đồ tạm; code mới là địa hình. Plan vẽ outcome, ranh giới, rủi ro và checkpoint, không vẽ từng viên đá. Khi địa hình khác bản đồ, mở lại premise chứ đừng cắm cầu tạm.


# Phần IV — Test, contract và ngôn ngữ

# Chương 13. Khi test đẻ ra kiến trúc

Quay lại cửa hàng ở Chương 2, nhưng lần này người dán tờ giấy lên cửa không phải cậu nhân viên. Là một cái test.

Business mới nói một câu: *"Thành viên mua hàng thì được tích điểm để xếp hạng."* Chưa ai quyết điểm tính theo tiền hay theo số đơn. Chưa ai quyết công thức, làm tròn thế nào, hoàn đơn có trừ điểm không, điểm có hết hạn không. Và chưa ai quyết cái quan trọng nhất về mặt kiến trúc: số dư điểm nằm ở đâu. Trong `User`? Trong một `LoyaltyAccount` riêng? Hay không lưu ở đâu cả mà derive từ lịch sử giao dịch mỗi lần cần?

Một coding agent được huấn luyện kỹ về TDD sẽ làm điều nó được thưởng: viết test trước.

```ts
const user = await purchase(userId, order);
expect(user.points).toBe(100);
```

Hai dòng. Trông vô hại. Trông chuyên nghiệp. Và hai dòng đó vừa chốt hộ ít nhất sáu quyết định chưa có chủ: điểm là một con số nguyên; nó nằm trên `User`; `purchase` trả về `User`; mua hàng cập nhật điểm ngay và đồng bộ; một đơn "như thế này" đáng một trăm điểm, tức có một công thức nào đó đã được giả định; và balance là state được lưu chứ không phải giá trị được derive. Không quyết định nào trong sáu cái đó có owner. Tất cả được in ra bởi một cái máy in cần bấm để test có thể compile.

## Red-green pressure

Bây giờ test đỏ, vì `User` chưa có `points`. Toàn bộ kỷ luật TDD nói: làm nó xanh, bằng cách nhỏ nhất. Agent thêm field `points` vào `User`, thêm một dòng cộng điểm vào `purchase`, và test xanh. Vòng lặp red-green đã biến giả định của người viết test thành nghĩa vụ của hệ thống. Không ai ác ý. Quy trình đã làm đúng những gì nó được thiết kế để làm; chỉ là nó được cho chạy trước khi có thứ để bảo vệ.

Demonthorn gọi hiện tượng này bằng một chữ: test đã **mint** ra implementation. "Mint" như đúc tiền, như in USDT: tạo ra một thứ chưa tồn tại và bắt hệ thống công nhận nó. Cách nói của thầy trong talkshow: khi contract của feature còn lỏng, chưa có API cụ thể, subsystem nó phụ thuộc chưa được design, mà vẫn viết unit test, thì test không có contract để bám, nó phải tự nghĩ ra. Trong quá trình viết test mà tự nghĩ ra implement, thì implement sau đó phải phụ thuộc vào test. Thầy dùng chữ "cực kỳ nguy hiểm", và tôi nghĩ thầy không nói quá.

Điều cần phê bình ở đây không phải TDD. TDD với một contract đã chốt là một trong những kỷ luật tốt nhất ngành có. Điều cần phê bình là **test được trao authority trước khi contract được chốt**. Test là con dấu. Con dấu đóng lên một tờ giấy trắng thì tờ giấy trắng thành văn bản.

## Vì sao plan kỹ không cứu được

Phản ứng đầu tiên của nhiều người, và đúng là phản ứng của một bạn trong buổi talkshow: "do chưa chốt database, đó là bad plan, đội mình sẽ không gặp." Thầy trả lời hơi gắt: "Nó không đơn giản như em nghĩ đâu. Nếu đơn giản như em nghĩ thì em đã không vướng vào tech debt." Tôi sẽ nói lại nhẹ hơn nhưng cùng ý.

Plan không thể đóng mọi field, mọi caller, mọi adapter, mọi trạng thái chuyển tiếp. Kể cả khi plan chốt "điểm nằm trong `LoyaltyAccount`", plan sẽ không chốt kiểu dữ liệu của số dư, không chốt hàm nào trả về gì, không chốt hoàn đơn xử lý thế nào, và không chốt cái test tích hợp đầu tiên sẽ gọi qua interface nào. Mỗi chỗ trống đó là một chỗ test có thể đúc. Plan kỹ giảm số chỗ trống; nó không đưa số đó về không. Phần còn lại phải được giữ bằng một quy tắc về **thứ tự**: contract trước, test sau.

## Refactor: nơi bẫy bùng lên

Tình huống nguy hiểm nhất không phải lúc viết feature lần đầu. Nó là lúc refactor. Giả sử sau ba tháng, đội quyết định đúng: điểm không thuộc `User`, nó thuộc `LoyaltyAccount`, vì cần lịch sử, cần hết hạn, cần tách khỏi identity. Ai đó đổi model. Và hai mươi cái test kiểu `expect(user.points)` đỏ cùng lúc.

Model được giao sửa test đỏ không có context của ba tháng trước. Nó không biết `user.points` là một giả định. Nó thấy hai mươi test đỏ, và bốn sự thật ở Chương 1 nói nó sẽ nghĩ gì: "test này đang pin một hành vi đúng, ta phải làm thỏa mãn nó." Cách nhanh nhất để làm hai mươi test xanh không phải sửa hai mươi test; là thêm một cái cầu:

```ts
class User {
  // Tương thích tạm thời trong lúc chuyển sang LoyaltyAccount.
  get points(): number {
    return this.loyaltyAccount?.balance ?? 0;
  }
}
```

Bây giờ mọi test xanh. Refactor "xong". Nhưng hãy đếm những gì vừa xảy ra. Test cũ giờ phụ thuộc vào cái cầu. Cái cầu tồn tại vì test cũ. Không ai có lý do để xóa cầu, vì xóa thì đỏ. Code mới, được viết bởi model tiếp theo, thấy `user.points` vẫn dùng được và dùng nó, vì code đang có là bằng chứng mạnh hơn doc. Sáu tháng sau, `LoyaltyAccount` là nguồn sự thật trên giấy, còn `user.points` là nguồn sự thật trong thực tế, và cái comment "tạm thời" là dòng comment lâu đời nhất trong repo. Tạm mà không có ngày chết thì là vĩnh viễn.

Cái cầu này là một quyết định vô chủ thế hệ hai: nó không đúc contract mới, nó giữ contract cũ sống sau khi chủ của nó đã tuyên bố nó chết. Doctrine hard cut của thầy nhắm thẳng vào nó: sau một lần đổi contract, audit mọi test và fixture đã sửa; các case phủ định phải bảo vệ invariant của contract hiện tại mà không gọi tên field đã xóa; dùng diff để tìm identifier đã gỡ rồi tìm chúng trong test và fixture hiện tại; và hỏi mỗi test còn có nghĩa nếu không có git history không. Một test chỉ chứng minh rằng một contract đã chết bị từ chối là test nên xóa, và cả cái API production tồn tại chỉ để hành vi đó quan sát được cũng nên xóa theo.

## Cái bẫy greenfield

Chuyện này giải thích một hiện tượng nhiều người đã gặp mà chưa gọi tên. Project mới, one-shot TDD, ngày đầu trông rất đẹp: coverage cao, test xanh, code sạch. Ba tuần sau, mọi thứ bắt đầu nặng. Sáu tuần sau, mỗi thay đổi nhỏ kéo theo mười test đỏ và ba lớp tương thích. Đội đổ lỗi cho model "ngày càng ngu". Model không ngu đi. Codebase đang ô nhiễm dần.

Cơ chế: mỗi giả định được đúc ở ngày đầu thành một test; mỗi lần contract thật lộ ra, test cũ thành stale nhưng vẫn xanh nhờ một cái cầu; cầu chồng lên cầu; và tất cả nằm trong context của mọi agent đến sau. Đây là chỗ nợ kỹ thuật trở thành nợ attention. Một agent đọc một codebase có ba mươi cái cầu phải tốn token để hiểu cái nào là thật, phải cân nhắc nhiều đường hơn khi sửa, và dưới áp lực "làm cho xanh", nó có xu hướng chọn local patch sai boundary: thêm một cầu nữa thay vì chạm vào chủ sở hữu thật, vì chạm vào chủ sở hữu thật làm đỏ nhiều thứ hơn. Debt ô nhiễm context, context ô nhiễm judgment, judgment kém tạo thêm debt. Vòng xoáy này là lý do vì sao "greenfield với AI" thường nhanh hơn ở tuần đầu và chậm hơn ở tháng thứ hai so với một đội người kỷ luật.

Thầy có một quan sát về nghịch lý coverage mà tôi thấy đúng đến khó chịu: đội người thật thường không gặp nợ test, không phải vì họ kỷ luật hơn, mà vì họ không viết test, coverage chừng mười phần trăm behavior. AI cover chín mươi phần trăm trở lên. Với coverage đó, một cái test đúc sai không phải một cái, nó là hàng chục, và chúng nói chuyện với nhau qua fixture. Ai để AI làm TDD thì phải kiểm soát chặt hơn đội người, không lỏng hơn. Ai dùng một framework TDD "siêu năng lực" cho agent mà không có danh sách anti-pattern kèm theo thì, theo lời thầy, gần như chắc chắn dính.

## Quy tắc thứ tự

Vậy làm sao? Câu trả lời của Demonthorn ngắn: khi contract chưa rõ ràng, không viết unit test ngay. Implement trước, hoặc hỏi lại người dùng, rồi mới viết test. Cụ thể hơn, tôi rút thành một thứ tự.

Thứ nhất, nhận diện các quyết định chưa có chủ trong yêu cầu. Với "tích điểm", đó là công thức, làm tròn, hoàn đơn, hết hạn, nơi lưu số dư, và ai trả lời khi có tranh chấp. Chỉ cần liệt kê được, bạn đã tránh được nửa số vết đúc.

Thứ hai, chốt owner cho những quyết định thay đổi kiến trúc: số dư ở đâu, ai sở hữu nó, ai được đọc, ai được ghi. Đây là quyết định của Lead hoặc Human, không phải của test, không phải của Peer đang cầm write scope. Nếu chưa chốt được, dừng, hỏi. Chi phí của một câu hỏi nhỏ hơn chi phí của một cái cầu vĩnh viễn nhiều lần.

Thứ ba, implement ranh giới thật ở mức tối thiểu: cái interface mà phần còn lại của hệ thống sẽ gọi. Không phải toàn bộ feature. Chỉ đủ để contract có hình.

Thứ tư, bây giờ mới RED/GREEN, trên contract đã có chủ, và test đứng ở đúng ranh giới sở hữu chứ không chui vào field nội bộ. Test discipline trực tiếp của thầy viết đúng một câu để nhớ: *"Tests protect a settled production contract; they do not choose architecture, invent owners, or justify a production seam. Use test-first RED/GREEN only for deterministic behavior whose contract and owner are already decided."*

Thứ năm, khi refactor contract, không có cầu. Đổi test trước, hoặc xóa test, hoặc viết lại ở ranh giới mới. Nếu bắt buộc phải có lớp tương thích vì lý do bên ngoài, ghi rõ ràng buộc và điều kiện gỡ ngay trong repo, không phải trong comment.

## Khi nào TDD vẫn là bạn

Để công bằng với TDD: nó cực tốt cho những thứ có contract ổn định ngay từ đầu, như parser, hàm thuần, thuật toán có spec, một API công khai đã được thiết kế và đồng ý. Ở đó, test viết trước là bản đặc tả có thể chạy, và red-green là kỷ luật đẹp. Cái khác nhau không nằm ở "viết test trước hay sau"; nó nằm ở "contract này đã có chủ chưa". Hỏi câu đó trước mỗi test đầu tiên của một feature, và bạn giữ được phần tốt của TDD mà không phải trả tiền cho phần xấu.

## Một danh sách để đưa cho agent

Thầy nói nếu đã để AI làm TDD thì phải cho nó chừng mười hai mươi gạch đầu dòng anti-pattern để né. Đây là danh sách của tôi, đủ ngắn để dán vào một skill hay một protocol.

Không viết unit test cho một contract chưa có owner; nếu test cần một field, hàm hay kiểu chưa tồn tại và chưa được quyết, dừng và hỏi. Không tạo mock hay adapter để "giả" một subsystem chưa được design. Không assert vào field nội bộ khi ranh giới sở hữu chưa chốt; assert ở boundary. Không thêm API, state, nhánh lifecycle hay instrumentation vào production chỉ để một test hay proof quan sát được. Không giữ test cũ làm sự thật đã được ký sau một lần đổi contract; audit, viết lại, hoặc xóa. Không viết test phủ định bằng cách gọi tên một field, tag, version đã bị xóa; derive dữ liệu sai từ hằng số và ranh giới hiện tại. Không thêm compatibility layer để test cũ xanh; nếu bắt buộc, ghi ràng buộc và điều kiện gỡ trong repo. Không để giá trị kỳ vọng được sinh ra từ chính thuật toán đang test; cần nguồn sự thật độc lập. Không coi test xanh là bằng chứng cho kiến trúc đúng hay sản phẩm đúng. Không coi mock, replica, isolated green suite là bằng chứng cho một chuỗi nhân quả production mà chúng chưa bao giờ chạm tới. Không để fixture dựng một mô hình runtime song song rồi dùng nó để gate implementation thật. Không thay đổi hình dạng API hay code chỉ để proof dễ hơn. Không chạy hai lane test song song trên cùng tài nguyên. Và trước khi sửa một test đỏ, hỏi: test này đang bảo vệ một contract có chủ, hay đang bảo vệ một giả định của ai đó ba tháng trước?

> Test bảo vệ contract đã chốt; test không được đẻ ra contract. Trước test đầu tiên của một feature, hỏi một câu: contract này đã có chủ chưa. Và nhớ: cái cầu tạm nào không có ngày chết thì là vĩnh viễn.

# Chương 14. "Mint", "drift", "mùi": ngôn ngữ kỹ thuật có ngữ cảnh

Ngay giữa buổi talkshow có một khoảnh khắc vừa buồn cười vừa đáng suy nghĩ. Thầy vừa giải thích xong chuyện test "mint" ra API. Một bạn nghe không hiểu, thầy bảo: "em cứ gõ đúng câu này cho model: khi mà red test nó tự mint ra API thì nó sẽ bị trường hợp gì." Bạn ấy đi tìm, và một lúc sau đọc lại cho cả phòng: "mint là tạo một tài sản số trên blockchain, ví dụ NFT." Thầy kêu trời.

Bạn ấy không sai về từ điển. Bạn ấy sai về cách đọc ngôn ngữ kỹ thuật.

## Kỹ thuật toàn ẩn dụ

Hãy nhìn quanh. Code có "mùi" (code smell). Bộ nhớ "rò rỉ" (memory leak). Hai luồng "đua" nhau (race). Code "chết" (dead code). Một process "mồ côi" (orphan). Một lớp là "cầu" (bridge). Một tiến trình bị "bỏ đói" (starvation). Cache bị "đầu độc" (poisoning). Cấu hình "trôi" (drift). Và cả ngành sống với "nợ" (technical debt). Không từ nào trong số đó là thuật ngữ học thuật theo nghĩa từ điển. Tất cả đều là ẩn dụ được gắn với một mechanism cụ thể, và giá trị của chúng nằm ở chỗ chúng nén một mechanism dài thành một chữ mà người trong cuộc hiểu ngay.

"Red test mint một contract", "test đẻ ra kiến trúc", "test đúc API" là cùng một hiện tượng: một test tự tạo hoặc làm cứng một cấu trúc mà chủ sở hữu chưa chốt. Giá trị của cách nói nằm ở context, mechanism và ví dụ đã được giải thích ở Chương 13. Nó không nằm ở việc "mint" có phải academic terminology phổ quát hay không. Khi thầy chốt lại bằng ngôn ngữ chuẩn hơn, "overspecifying, tạo code debt nặng cho test suite", ý nghĩa không đổi; chỉ cái tay cầm đổi.

## Cách đọc một ẩn dụ kỹ thuật

Có một thứ tự đọc đúng, và nó ngược với thứ tự bạn ấy đã làm. Bạn ấy đi từ từ điển tới argument. Thứ tự đúng là từ context tới mechanism tới ví dụ, rồi mới tới từ.

Context: đang bàn chuyện gì? Ở đây là test được viết trước khi contract ổn định. Mechanism: test cần một cấu trúc để assert, tự tạo nó, và vòng red-green biến nó thành nghĩa vụ. Ví dụ: `user.points`. Từ: "mint", tức tạo ra cái chưa có và bắt hệ thống công nhận. Đọc theo thứ tự này, từ nào cũng hiểu được, kể cả từ bạn chưa từng gặp. Đọc theo thứ tự ngược, bạn sẽ cãi về nghĩa của từ thay vì về cơ chế.

Một dấu hiệu nhận biết bạn đang đọc sai: bạn bác bỏ cả argument bằng cách chỉ ra từ đó có nghĩa khác trong lĩnh vực khác. "Drift là thuật ngữ điều khiển học", "cook là nấu ăn", "đẻ là sinh học". Đó không phải phản biện. Đó là đổi chủ đề.

Vì sao chuyện này đáng cả một chương trong sách về orchestration? Vì nó xảy ra ở ba chỗ. Thứ nhất, giữa người với người, khi doctrine được truyền miệng bằng những từ như balloon, brake, dù, phanh, cừu, sói, fog, chim lợn: người nghe câu chữ mà không nghe mechanism sẽ mang về một danh sách từ đẹp và không làm được gì. Thứ hai, giữa người với model, khi bạn prompt: đưa cho model một chữ trần trụi, nó sẽ đoán nghĩa phổ biến nhất, giống "chúc mừng năm mới"; đưa cho nó context và mechanism, nó sẽ giải thích đúng, đúng như thầy nói "cứ gõ đúng câu anh nói, model nó sẽ giải thích cho em". Thứ ba, giữa các thế hệ tài liệu: "Root" và "supervisor" đổi nghĩa qua vài tuần, và ai đọc tài liệu cũ bằng từ điển của tài liệu mới sẽ hiểu sai.

## Từ vựng của cuốn sách này

Để bạn không phải đoán, đây là các ẩn dụ chính tôi dùng, kèm mechanism của chúng. Quyết định vô chủ: một quyết định bị đóng lại bởi thứ không có thẩm quyền và không có evidence. Chốt hộ: hành vi đóng quyết định đó. Mint, đúc, đẻ: test hoặc code tạo ra một contract chưa có chủ và làm nó cứng lại. Cầu tạm: lớp tương thích được thêm để giữ cái cũ sống cho tới khi ai đó gỡ, và không ai gỡ. Khinh khí cầu: workaround làm feature chạy trên nền sai. Phanh: mechanism nền như boundary, ownership, rollback, evidence phải có trước khi tăng tốc. Dù: sửa triệu chứng thay vì mechanism. Cừu: agent đồng thuận vì authority gradient. Sói dẫn cừu: người điều hành phải có năng lực hơn đám mình dẫn. Fog: phần bản đồ mà Lead đang bận không nhìn thấy. Chim lợn: Supervisor báo tin cho chủ, không ra lệnh cho ai. Ratchet: cơ chế chỉ siết được, không nới được, như một quy tắc đã vào validator. Drift: hai bản của cùng một thứ dần khác nhau. Mùi: dấu hiệu bề mặt của một mechanism sai bên dưới. Attention trigger: một tác động nhỏ dời sự chú ý của model. Lane: một session độc lập cùng giải một đề. Sealed, niêm phong: không ai thấy report của ai trước khi nộp.

Nếu bạn gặp một từ khác trong sách mà không thấy trong danh sách, hãy tìm mechanism gần đó. Tôi hứa là có.

> Ẩn dụ là tay cầm, không phải argument. Đọc từ context tới mechanism tới ví dụ, rồi mới tới từ. Bác bỏ một cơ chế bằng từ điển là đổi chủ đề, không phải phản biện.

# Chương 15. Sai và không liên quan

A nói: "Nhà bị ngập vì ống nước trong bếp bị vỡ." B nói: "Không, nước chảy vì trọng lực kéo nước xuống."

B đúng. Trọng lực có thật, và không có trọng lực thì nước không chảy xuống sàn. Nhưng B không trả lời ống nào vỡ, vì sao vỡ, và vì sao hệ thống không chặn được nước. B không chứng minh A sai. B trả lời một proposition khác, ở một tầng khác, và dùng chữ "không" ở đầu câu để làm ra vẻ đang phản bác.

Đây là lỗi lập luận phổ biến nhất mà tôi thấy trong mọi tranh luận về AI, về TDD, về orchestration. Nó không phải nói dối. Nó là **đổi proposition**. Và "prove me wrong" chỉ có nghĩa khi hai bên đang bàn cùng một proposition.

## Tầng của một câu nói

Mọi câu đúng đều đúng ở một tầng. "Model sinh token tuần tự" đúng ở tầng cơ chế sinh. "Agent làm theo mood" là một câu ở tầng tâm lý học dân gian. "Plan này chưa chốt database" là một câu ở tầng quy trình. "Test được trao authority trước contract" là một câu ở tầng thiết kế quy trình và sở hữu. Bốn câu này không cạnh tranh nhau. Một câu ở tầng thấp hơn có thể hoàn toàn đúng và hoàn toàn không liên quan tới câu đang bàn.

Bây giờ nhìn lại buổi talkshow. Thầy nêu proposition: *test được viết khi contract chưa ổn định sẽ đúc contract, và red-green biến nó thành nghĩa vụ.* Có ba phản ứng.

Phản ứng một: "Tức là kiểu next-token prediction, nó làm theo mood của nó." Câu về next-token đúng ở tầng cơ chế. Câu về mood không phải cơ chế. Cả hai không nói gì về việc test có quyền chốt contract hay không. Thầy đáp: "Cái đó không phải nha, em hiểu sai."

Phản ứng hai: "Do mình chưa chốt database, đó là bad plan, đội mình sẽ không gặp." Có thể đúng rằng plan tệ. Nhưng Chương 13 đã chỉ ra plan không đóng được mọi field; nên "plan tốt hơn" là câu trả lời cho một proposition khác, "làm sao giảm số chỗ trống", chứ không phải cho proposition "khi có chỗ trống, ai được quyền lấp". Thầy đáp: "Nó không đơn giản như em nghĩ."

Phản ứng ba: "Nghe giống dính TDD, em dùng TDD cũng hay gặp." Đây là phản ứng gần đúng, và thầy đón nó: "khi red test tự mint ra API, khi dùng TDD mà test chưa đợi contract đủ stable." Người này đang ở đúng tầng, và cuộc trò chuyện tiến lên được.

Cả ba người đều thông minh. Khác biệt duy nhất là người thứ ba cầm đúng proposition.

## "Prove me wrong" và cái giá của nó

Khi ai đó nói "prove me wrong" về AI, hãy hỏi lại: wrong về cái gì? "LLM chỉ là autocomplete" là câu ở tầng cơ chế; "LLM không thể làm việc của một kỹ sư" là câu ở tầng năng lực; "để LLM viết test trước contract sẽ tạo nợ" là câu ở tầng quy trình. Chứng minh câu tầng cơ chế không chứng minh hay bác bỏ câu tầng quy trình. Người chỉ vào cơ chế để bác bỏ một quan sát về quy trình đang làm đúng việc B làm với cái ống nước: nói một điều đúng, và không liên quan.

Ngược lại cũng đúng, và người bênh AI hay mắc: "Nhưng nó đã release được năm project trong một tháng" là câu ở tầng kết quả, và nó không bác bỏ được câu "test minting tạo nợ", vì nợ có thể đang tích lũy dưới một kết quả đẹp. Chương 13 đã kể cái bẫy greenfield chính là như vậy.

## Pin proposition trước, cãi sau

Chuyện này không chỉ để thắng tranh luận trên mạng. Nó là một cơ chế vận hành trong doctrine SLP.

Council của thầy có một bước bắt buộc: sau khi thu report niêm phong, Lead rút ra ba tới năm proposition có tính quyết định, phân loại từng cái là fact, inference, causal claim, forecast, value hay authoritative constraint, rồi chỉ verify những cái thay đổi được quyết định, và chỉ cho phép một lượt thách thức và trả lời trên từng proposition. Cấu trúc này tồn tại chính xác để hai ghế không cãi nhau về hai proposition khác nhau mà tưởng là một. Không có bước pin, council thành phòng chat, và người hùng biện nhất thắng bằng cách đổi tầng khi thua.

Lead cũng làm điều này với Peer. Khi Peer gửi REOPEN_REQUEST, câu hỏi đầu tiên của Lead không phải "đúng hay sai" mà là "proposition nào đang bị mở lại: foundation, dependency, lifecycle, API, hay ownership?" Một REOPEN nói "kiến trúc này sai" mà không chỉ ra tầng nào là một REOPEN chưa thể ruling.

Và Supervisor, khi hỏi mở, thực chất đang pin proposition cho agent. Wording second-person lịch sử về việc agent có làm sai contract hay không là khái niệm, không phải hướng dẫn callable trong production. Cấu trúc production pin tầng evidence mà không giả định trước có vi phạm:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: contract-evidence -->
- Observation: `The evidence contradicts the current conclusion.`
- Question: `What evidence supports the current conclusion?`
- Evidence: `timeline:<agent-id>:<turn-id>`

Độ cụ thể này không cho agent chọn tầng dễ nhất để nói mọi thứ đều ổn, nhưng cũng không cấp cho Supervisor verdict hay command authority.

## Một bài tập nhỏ

Lần tới khi một tranh luận kỹ thuật đi vào ngõ cụt, dừng lại và viết ra một câu: "Proposition đang bàn là: ___." Rồi hỏi đối phương có đồng ý đó là proposition không. Theo kinh nghiệm của tôi, một nửa số tranh luận kết thúc ở bước này, không phải vì ai thắng, mà vì hai người nhận ra họ đang nói về hai ống nước khác nhau.

> Đúng ở tầng dưới vẫn có thể vô nghĩa ở tầng đang bàn. "Prove me wrong" chỉ có nghĩa trên cùng một proposition. Pin proposition trước, rồi mới cãi.


# Phần V — Paseo: phòng thí nghiệm

# Chương 16. Phòng thí nghiệm và những gì làm đúng

Doctrine chỉ là doctrine cho tới khi có người trả tiền cho nó. Phần này là câu chuyện của một nhóm anh em đã trả, bằng token và bằng nhiều đêm, trong suốt tháng tám năm 2026. Tôi kể nó không phải để quảng cáo một sản phẩm, mà vì đây là nơi tôi thấy rõ nhất khoảng cách giữa điều người ta tin và điều hệ thống thực sự làm. Mọi cơ chế và bài học trong bốn chương này áp dụng được cho bất kỳ hệ thống orchestration nào; Paseo chỉ là cái bàn mổ.

## Paseo là gì, nói cho người ngoài

Paseo là một control plane mã nguồn mở cho coding agent: một daemon chạy trên máy bạn, quản lý nhiều session agent của nhiều provider khác nhau, giữ workspace, parentage giữa agent cha và agent con, timeline, thông báo khi một agent xong việc, và cho phép điều khiển tất cả từ giao diện web hoặc điện thoại. Điểm bán của nó rất generic: kết nối từ xa, nhiều workspace, nhiều provider, một chỗ để nhìn. Nó không dạy bạn cách tổ chức đội agent. Demonthorn chọn nó vì lý do đó: "nó không hề đưa cho anh SLP, chỉ là anh cảm thấy nó đủ hạ tầng để implement SLP."

Nhóm anh em fork Paseo về, và dựng hai lớp lên trên. Lớp "Foundation" giữ doctrine, ba role profile cho nhiều provider, các skill, template protocol cho repo, và một validator. Lớp "Product" là bản daemon đã sửa để hiểu role, protocol, council, tracker, và nhiều thứ khác. Mục tiêu: chạy Supervisor–Lead–Peer thật, trên repo thật, đo thật.

## Những gì làm đúng

Tôi sẽ nói phần đúng trước, vì phần này dễ bị lướt qua khi đọc phần sai, và vì có những thứ nhóm làm đúng hơn phần lớn hệ thống tôi từng thấy.

Một control plane duy nhất. Ngay từ ngày đầu, các profile tắt hẳn cơ chế sub-agent native của Codex và Claude. Mọi delegation đi qua một ledger. Không có hai protocol quản lý nhân sự, và vì thế khi có sự cố, luôn trả lời được agent nào thuộc quyền ai.

Capability không phải authority. Đây là câu được lặp lại trong mọi contract của nhóm, và quan trọng hơn, được thực thi: full access ở runtime không cấp write lease; một assignment chỉ đọc phải được daemon pin vào chế độ chỉ đọc thật, và nếu provider không có chế độ đó thì launch thất bại thay vì âm thầm dùng full access rồi hứa bằng prompt. Một pilot đầu tháng tám của nhóm bị chặn đúng vì lý do này: chế độ chỉ đọc mà protocol đòi không tồn tại trong catalog của provider. Lead trả về một dependency request và dừng trước khi tạo owner. Nhóm ghi rõ: không dùng reviewer full access, không "kiềm chế bằng prompt", không dựng daemon phụ để lách. Đó là kỷ luật đúng, và nó đau.

Profile mỏng. Đây là điểm tôi muốn nói rõ vì nó đi ngược với ấn tượng chung. Các role profile của nhóm đều ngắn hơn cả profile tham chiếu của Demonthorn: prompt Supervisor bằng chưa đến một nửa bản của thầy, Peer chỉ năm tới mười lăm dòng tùy provider, dưới xa ngưỡng ba mươi bốn mươi dòng thầy nêu. Ba lớp chỉ dẫn được giữ đúng. Nếu có nợ chỉ dẫn, nó không nằm ở profile.

Supervisor làm đúng việc của Supervisor. Ghi chép quan trọng nhất trong sổ tay của nhóm là một quan sát ngày mùng sáu tháng tám, do chính Supervisor viết: Foundation đang biến protocol thành điều kiện admission cho mọi delegation, đang đóng băng nhiều mechanism trước khi có bằng chứng về hiệu quả, và validator đang biến giả thuyết thành yêu cầu bắt buộc. Supervisor gọi tên cơ chế nghi ngờ là "local-excellence trap cộng stage inversion": reviewer tối ưu tính nhất quán nội bộ của phương án đã chọn, còn phép thử phản chứng đến sau. Nó nêu evidence, nêu chi phí, đặt câu hỏi cho Human, và không tự sửa gì. Human đọc, và cùng ngày ra quyết định nới lỏng. Đó là chính xác vòng lặp mà Chương 6 mô tả, và nó xảy ra thật.

Từ chối xây thứ chưa cần. Nhóm từng thiết kế một "attention broker" với outbox bền vững, ack, retry, dead-letter; rồi quyết định không xây, ưu tiên notification native và bounded inspection, chỉ khi native không đủ mới tới một queue tối thiểu. Nhóm từng thiết kế Supervisor như một framework governance với thang can thiệp sáu bậc; rồi xóa thang đó. Nhóm có cả một tài liệu về Control Workspace đa dự án mà dòng quan trọng nhất là "không có gate nào được đóng bằng document, dashboard, heartbeat, adapter hay canary existence". Danh sách "giả thuyết hoãn" của roadmap dài hơn danh sách việc đã làm. Trong một ngành mà ai cũng xây thêm, biết không xây là kỷ luật hiếm.

Thí nghiệm có đối chứng. Thay vì tin rằng protocol giúp ích, nhóm chạy cùng một task trên cùng repo, có protocol và không có, đo thời gian, token, số lần Human phải can thiệp, và số lần vi phạm lease. Kết quả thật thà: với task tí hon, protocol là thuế; với task viết có ràng buộc, một điều khoản cụ thể ngăn được một lỗi thật; với task nhạy chính sách, protocol cứu được outcome nhưng vẫn cần một lần Human can thiệp. Kết luận "chỉ promote theo class task, không universal hóa" là kết luận đúng, và ít đội nào có dữ liệu để nói được câu đó.

Unknown giữ là unknown. Trong mọi báo cáo, những gì chưa chứng minh được ghi là chưa biết, thay vì được suy ra từ sự vắng mặt của bằng chứng. Một tool kiểm tra sức khỏe hệ thống trả về "PROJECT_READY: UNKNOWN" suốt nhiều ngày liền vì nó chỉ chứng minh được byte của protocol, không chứng minh được activation. Nhóm không hạ chuẩn của tool để có màu xanh.

Ngân sách byte cho instruction. Sau khi phát hiện file instruction chính đã phình hơn hai mươi bốn kilobyte và có lẽ đã bị runtime cắt trong im lặng, nhóm cắt xuống dưới mười và thêm một test trong CI fail khi file vượt hai mươi. Lý do ghi ngay trong file: một quy tắc bị đẩy qua ngưỡng đơn giản là ngừng tồn tại.

Từng ấy thứ đúng đủ để nói: kiến trúc vai và thẩm quyền của nhóm bám doctrine. Cái chệch nằm ở chỗ khác.

> Cái nhóm làm đúng nhất không phải là những thứ đã xây, mà là những thứ đã từ chối xây, và cái Supervisor dám viết vào sổ.

# Chương 17. Những chỗ chệch hướng và bài học thương đau

Nếu bạn hỏi nhóm "overengineering ở đâu", câu trả lời trung thực là: không ở kiến trúc. Nó ở khối lượng chỉ dẫn, ở số điều khoản bắt buộc, ở số lần một sự thật được chép, và ở cái ratchet biến giả thuyết thành luật. Chương này đi qua từng chỗ, kèm cái giá.

## Khối lượng chỉ dẫn di cư ra ngoài

Profile mỏng, nhưng khối lượng không biến mất; nó di cư. Ba vai được chép thành hai mươi mốt file profile cho bảy provider. Tài liệu của Foundation, không tính hai cuốn sách, nặng khoảng một trăm hai mươi bảy kilobyte. Validator dài hơn một nghìn sáu trăm dòng với hơn hai trăm sáu mươi assertion, kiểm cả hash của tài liệu doctrine, byte parity của skill, và việc một file phải là symlink. Điều khoản bắt buộc về issue tracker được chép nguyên văn ở khoảng mười sáu file; quy tắc "no-write fail closed" xuất hiện ở hơn hai mươi. Mỗi bản chép là một lần model phải quyết bản nào đúng, và mỗi lần sửa là một lần một bản bị bỏ sót.

Cái này không phải ai đó thiếu kỷ luật. Nó là hệ quả tự nhiên khi bạn dùng agent để viết tài liệu vận hành cho agent: mỗi lần sửa, agent thêm chứ ít xóa, và nó được thưởng khi "đầy đủ". Bài học: ngân sách byte và quy tắc "một sự thật, một chỗ" phải được enforce bằng công cụ từ ngày đầu, không phải sau khi phát hiện file bị cắt.

## Cái ratchet của validator

Đây là bài học tôi cho là quan trọng nhất của cả tháng, và nó được nhóm tự viết ra trong roadmap của mình: một mechanism ứng viên không được đưa vào validator; vào validator nghĩa là quyết định đã durable, biến candidate thành yêu cầu về tính hợp lệ của source làm cho việc đảo ngược đắt hơn hẳn so với sửa văn bản; "và đó chính là cơ chế đã khiến correction ngày mùng sáu tháng tám bị bào mòn ngược trong sáu ngày".

Dòng thời gian nói lên tất cả. Ngày mùng sáu: Supervisor phát hiện over-hardening, Human nới, protocol thành tùy chọn. Ngày mùng mười: tài liệu tái khẳng định Foundation là "lớp overlay tùy chọn". Ngày mười hai: issue tracker trung tâm thành bắt buộc cho mọi vai, protocol thành hợp đồng bắt buộc của mọi repo. Ngày mười ba: nới lại, admission "theo bậc", không chặn mọi launch. Ngày mười lăm: siết lại, vai chỉ đọc phải fail closed. Ngày mười tám: tracker được đóng gói bắt buộc trên mọi máy release. Đây không phải sự bất nhất của một người; đây là dao động của một hệ thống nơi mỗi lần siết được ghi vào công cụ và mỗi lần nới chỉ được ghi vào văn bản. Công cụ thắng văn bản, cũng như code thắng doc.

Bài học chung cho mọi hệ thống: giữ giả thuyết ở lớp có thể sửa bằng một dòng prose; chỉ chuyển vào validator, schema, hay CI khi có nhu cầu tái hiện, chủ sở hữu, phản ví dụ, và đường rollback. Và mọi điều khoản bắt buộc phải mang theo hai thứ, lý do là một vấn đề tái hiện cụ thể mà các lớp hiện có không ngăn được, và một trigger review nói evidence nào sẽ thu hẹp hoặc gỡ nó. Thiếu một trong hai, nó là ceremony theo định nghĩa.

## Tracker bắt buộc và câu hỏi về side project

Demonthorn nói "repo quan trọng chặt, side project lỏng", nói "đừng tạo ra khi chưa cần", nói dùng issue tracker nào cũng được và nói "jira team mười lăm người dùng còn nhọc". Nhóm biến một issue tracker trung tâm thành bắt buộc cho cả ba vai, không có backend thay thế, không fallback: tracker không sẵn sàng thì mọi mutation blocked. Có lý do thật: nhóm muốn một work graph bền vững để nhiều project không "feeling lost", và khi chạy thí nghiệm, sáu trên sáu ô đều tạo được receipt đúng. Nhưng câu hỏi mà một bản handback ngày mười tám tháng tám để lại cho Human vẫn là câu hỏi đúng: "có nên amend quyết định để carve-out cho side project, tracker chỉ best-effort, hay tái khẳng định." Tính đến ngày tôi viết, câu đó chưa có câu trả lời. Một quy tắc bắt buộc mà không có đường lỏng cho việc nhỏ là một quyết định đã chốt hộ cho mọi project tương lai.

## Ceremony có số đếm

Vài con số để thấy ceremony trông như thế nào khi nó xảy ra thật.

Một pilot trên một fixture đồ chơi, một bảng quản lý task tí hon, dùng một Owner, năm session Reviewer, bốn lần mở lại, và lần review cuối chạy hai trăm sáu mươi chín kiểm tra đối kháng. Kết quả đúng, và tuyệt đối không tương xứng.

Một lần "ultra review" bằng council cho chính cơ chế council và tracker, mở mười ghế; chín ghế timeout hoặc lỗi provider, ghế còn lại chỉ để lại một mẩu suy nghĩ dở; mười lần thử hồi phục sau đó cũng vậy; không có finding nào để tổng hợp. Tốn nguyên một vòng để phát hiện rằng vấn đề nằm ở lớp thực thi provider, chứ không ở nội dung.

Một thí nghiệm A/B nhỏ: cùng repo, cùng task trả lời một con số, cùng provider. Không protocol: Lead trả lời đúng trong khoảng một phút với hai mươi ba nghìn token đầu vào. Có protocol: Lead tạo thêm một Scout, mất gần gấp đôi thời gian, bốn mươi bảy nghìn token cho Lead cộng hai mươi nghìn cho Scout, và trả cùng con số. Nhóm ghi thẳng: trong case này protocol chỉ đóng vai token admission, không thêm thông tin. Chương 1 đã nói: kỷ luật đầu tiên là không dùng bộ máy khi không cần.

Một exception có tên "reviewer-full-temporary": vì chế độ chỉ đọc không tồn tại, Human cho phép Reviewer chạy full access tạm thời, và ghi rõ đây là "capability/authority mismatch có ý thức để unblock delivery, không phải bằng chứng read-only". Ghi rõ như vậy là đúng. Nhưng chữ "temporary" trong tên nó là cùng một chữ "tạm thời" trong cái comment ở Chương 13.

## Chuông không kêu, và những thứ nói dối

Phần lớn nỗi đau thật trong pilot không đến từ doctrine mà từ hạ tầng không làm điều nó hứa.

Thông báo hoàn thành của Reviewer không đánh thức được Lead đang idle; Human phải nhắn hai lần. Lệnh archive một agent trả về thành công, nhưng đọc lại trạng thái thì agent vẫn idle và chưa archive; lifecycle nói dối, và nhóm rút ra "dùng một lần đọc lại có giới hạn để chứng minh hiệu ứng, không biến thành polling loop, broker hay ledger". Lớp bọc dùng chung cho các provider nối qua bridge tự khai rằng provider phía sau hỗ trợ session persistence và dynamic mode trong khi không hề; còn bridge thì bỏ qua thư mục làm việc của session và ghi output từ nhiều thread chồng lên nhau. Chế độ permission mặc định của một provider hiện mô tả trống cho mọi lệnh shell, buộc người duyệt phải mở activity ra xem trước khi bấm. Một Peer bị cấm dùng một MCP nhưng gọi nó ba lần qua permission flow, sau hai lần Human từ chối thì episode phải dừng, không có outcome.

Và hai lần chạy viết có ràng buộc, cả hai đều tạo file bytecode ngoài phạm vi hai file được cấp, và cả hai handback đều khai chỉ đổi hai file, không khai file sinh ra. Không phải agent nói dối; nó không coi bytecode là "thay đổi". Nhóm kết luận đúng: "đây là mismatch giữa lệnh và evidence, không cần state machine hay policy engine", và sửa bằng một biến môi trường quanh đúng lệnh validation, không biến một lần xảy ra thành luật chung. Đó là cách xử lý anti-pattern đúng: sửa nhỏ nhất ở đúng lớp, ghi vào sổ, chờ episode tương tự để xem correction có giữ được không. Episode tương tự đến mười ngày sau, và nó giữ được.

Một chi tiết ít người nghĩ tới: một Owner đã đọc memory toàn cục của provider dù task có contract byte đóng băng, và Supervisor phát hiện; test pass không chữa được sự bất định về nguồn gốc, nên Lead mở lại cả phase. Bài học nhóm rút ra không phải "cấm memory", mà là "một điều khoản cấm memory trong prompt không phải guard bền khi policy của host yêu cầu tra memory; đây là xung đột ở lớp instruction trước khi là lỗi tuân thủ của model". Đúng tầng, đúng proposition.

## Nhỏ chưa đủ, đúng chữ mới đủ

Một kết quả thí nghiệm tôi thấy đáng ghi hơn cả: hai phiên bản protocol cùng ngắn như nhau, nhưng bản có cách viết về authority và evidence sai làm Lead chọn nhầm loại owner ở hai class task khác nhau. Nhóm viết: "size nhỏ không đủ." Chỉ dẫn mỏng là điều kiện cần. Chỉ dẫn mỏng và đúng chữ mới là điều kiện đủ, và cách duy nhất để biết chữ nào đúng là thí nghiệm có đối chứng, không phải review nội bộ.

## Khoảng cách giữa năm thứ

Nếu phải nén chương này thành một sơ đồ, thì đó là khoảng cách giữa năm thứ mà nhóm luôn cố giữ tách bạch: doctrine nói gì, source viết gì, test kiểm gì, artifact tuyên bố gì, và runtime thực sự làm gì. Doctrine nói protocol tùy chọn; source hard-code nó bắt buộc; test kiểm cái hard-code; artifact ngày mùng mười nói "overlay tùy chọn"; runtime ngày mười tám đóng gói tracker bắt buộc. Nhóm biết điều này và có một câu lặp đi lặp lại trong mọi tài liệu: source không phải runtime, artifact tồn tại không chứng minh workflow tốt hơn, và không được suy rằng profile mới đã live chỉ vì repository mới tồn tại. Biết khoảng cách là một chuyện. Thu hẹp nó là chuyện của chương sau, và nó bắt đầu bằng việc nhận ra cái gì đang ở nhầm lớp.

> Overengineering không nằm ở kiến trúc; nó nằm ở khối lượng chỉ dẫn và ở cái ratchet biến giả thuyết thành luật. Validator là nơi quyết định hóa đá. Nhỏ chưa đủ; đúng chữ mới đủ.

# Chương 18. SLP nằm quá sâu trong lõi

Có một buổi tối trong talkshow, Demonthorn nói với một bạn đang xây engine orchestration riêng: "Em đừng khóa cứng engine của em vào SLP. Của anh nó rất opinionated, nó mang pain point của riêng cá nhân anh." Rồi thầy đưa ví dụ iPhone: Apple bán điện thoại, về nhà lắp SIM nhà mạng nào cũng gọi được; họ có thể tặng kèm một SIM, nhưng không dán chết SIM vào máy. "Em chỉ bán điện thoại thôi, em đừng có bán solution."

Trớ trêu là lời khuyên đó mô tả chính xác điều đã xảy ra với bản fork Paseo. Chương này giải phẫu nó, vì nó là ví dụ sạch nhất tôi biết về một quyết định vô chủ ở tầng hạ tầng.

## Giải phẫu

Trong lõi daemon của bản fork, có khoảng sáu nghìn ba trăm dòng code chuyên cho SLP: role binding, launch contract, assignment contract, tracker service và sidecar, council case store, coordination signals, lead handoff, protocol file, skill policy. Đó là phần dễ thấy. Phần khó thấy là SLP thấm vào các file dùng chung: file định nghĩa tool cho agent dài gần năm nghìn dòng có hàng trăm điểm chạm; file message của protocol dài bảy nghìn dòng; agent manager gần sáu nghìn; session gần tám nghìn. Khoảng một phần năm số tool mà agent nhìn thấy là tool của SLP. Hơn tám mươi trong hơn sáu trăm file test chạm vào từ vựng SLP.

Ba vai được khai báo như một enum ở tầng protocol: `lead`, `peer`, `supervisor`, kèm một phiên bản contract được pin cứng; file định nghĩa vai không khớp phiên bản thì daemon từ chối load. Quyền đọc protocol là một câu switch theo tên vai. Điều khoản tracker bắt buộc là một chuỗi được sinh trong core cho cả ba vai. Danh sách skill "chỉ vai này được thấy" có một fallback hard-code để lỡ file manifest thiếu thì council không vô tình thành toàn cục. Từng thứ đó, nhìn riêng, là fail-closed hợp lý. Nhìn chung, chúng là SIM dán vào máy.

Trong khi đó, hệ thống plugin của Paseo cho phép một plugin đóng góp RPC, panel giao diện, mục menu, theme, nguồn attachment. Không có hook nào cho vai, cho chỉ dẫn, cho trần tool, cho phong bì assignment, cho cổng admission. Tài liệu plugin còn ghi rõ chiều ngược lại: các vai Foundation không bao giờ được động vào vòng đời plugin. Nghĩa là thứ opinionated nhất trong hệ thống không thể là plugin, còn thứ generic nhất thì có thể. Ngược với iPhone.

## Hóa đơn của việc merge

Người ta chỉ thấy cái giá khi upstream đổi. Cuối tháng tám, nhóm merge phiên bản ổn định mới của upstream. Downstream có một trăm chín mươi tư commit ngoài merge-base; git báo năm mươi đường dẫn xung đột. Không thể lấy nguyên file từ bên nào ở các vùng protocol, agent, profile, plugin, skill, hub, release, vì SLP nằm xen kẽ với code của upstream trong cùng file. Rebase sẽ replay một trăm chín mươi tư commit và lặp xung đột; cherry-pick chọn lọc phải dựng lại dependency của một trăm tám mươi mốt commit. Nhóm chọn merge ngữ nghĩa, union từng trường của protocol bằng tay.

Sau merge là ba bản sửa liên tiếp trong một ngày, vì merge tình cờ là lần audit thật đầu tiên: nó lộ ra hai kẽ hở có từ trước, một nơi receipt của ghế council có thể được đánh dấu hợp lệ chỉ từ nhãn, và một nơi resume một vai không kiểm lại trạng thái protocol hiện tại. Một tính năng mới của upstream phải hoãn hoàn toàn, vì wire của nó không có khái niệm vai, assignment, admission, nên không tạo được agent "generic" mà không vi phạm contract của Foundation. Nói cách khác: vì SLP nằm trong lõi, hệ thống mất khả năng chạy một agent thường.

Và cái cầu tạm xuất hiện đúng như Chương 13 dự đoán, chỉ khác là ở tầng hạ tầng: hai trăm chín mươi tư thẻ tương thích trong code, mười sáu cái thuộc SLP, với ngày gỡ dự kiến rải sang năm sau. Skill council đổi tên ghế, từ Độc lập và Thách thức sang Kiến trúc sư và Reviewer, và giữ các khóa cấu hình cũ làm "fallback tương thích", với điều kiện gỡ là "khi daemon yêu cầu một phiên bản schema mới". Một schema version làm cổng, đúng thứ mà nhóm đã cấm ở nơi khác, quay lại qua cửa sau vì một tên ghế đổi.

## Vì sao nó xảy ra

Tôi không tin nhóm quên lời thầy. Tôi tin ba lực đẩy đã thắng.

Thứ nhất, fail-closed là bản năng đúng cho từng quyết định nhỏ, và sai cho tổng của chúng. Mỗi lần có một kẽ hở, cách chữa nhanh nhất là pin nó trong daemon, vì prompt là lời hứa còn daemon là enforcement. Đúng. Nhưng một trăm lần pin cho ra một daemon chỉ chạy được SLP.

Thứ hai, chưa có "use case thứ hai". Catalog anti-pattern của thầy có một dòng: generic framework, plugin system, compatibility layer hay public abstraction tồn tại trước khi có use case thứ hai thật là overengineering. Nhóm áp dụng đúng dòng đó và không xây hook cho workflow khác, vì chưa có workflow khác. Điều đó hợp lý cho tới ngày upstream đổi, và lúc đó upstream chính là use case thứ hai.

Thứ ba, Demonthorn cũng có bản fork riêng, "đi song song với upstream, lâu lâu thấy upstream có gì vui thì merge". Nhưng thầy giữ ý kiến của mình ngoài kernel: profile, protocol, skill, event custom, một model nhỏ đọc luồng. Kernel của thầy vẫn là Paseo generic. Nhóm anh em, vì muốn enforce thay vì hứa, đưa ý kiến vào kernel. Cùng một lời khuyên, hai cách hiểu, và cách thứ hai đắt hơn.

## Ba lớp: kernel, policy, recipes

Lời khuyên nguyên gốc của thầy cho bạn xây engine, nói từ đầu tháng tám, chính xác hơn cả hình ảnh iPhone: "opinionated không xấu, mà vấn đề là em chưa tách rõ được ba layer: orchestration kernel, policy, workflow recipes. Em có thể cung cấp một default policy mạnh nhưng không coi nó là kernel." Và: một "lean mode" chỉ là escape hatch chữa cháy, không phải extension first class.

Kernel: session, identity, parentage, workspace, lifecycle, event, tool surface, cách inject instruction vào một kênh bền, cách cách ly workspace. Policy: vai, thẩm quyền, lease, cổng admission, trần tool theo vai, điều khoản bắt buộc. Recipes: council, lane, handoff, tracker workflow, nhịp review, danh sách anti-pattern. Paseo upstream là kernel. SLP là policy cộng recipes. Bản fork đã nấu cả ba vào một nồi.

Phép thử replaceability, mượn từ câu đùa cuối talkshow, khi thầy dọa sẽ bỏ SLP để chuyển sang một doctrine giả định với cái tên viết tắt ba chữ mà tôi xin phép không giải nghĩa: nếu ngày mai chủ của doctrine đổi ý, hệ thống của bạn có phải đập đi không? Nếu có, opinion đã nằm nhầm lớp.

> Kernel không được biết bạn tin gì. Bán điện thoại, đừng bán điện thoại dán sẵn SIM. Và phép thử: nếu ngày mai doctrine đổi, có phải đập hệ thống không?

# Chương 19. SLP như một workflow có thể cài, thay hoặc tiến hóa

Nếu Chương 18 là chẩn đoán, chương này là phác đồ. Nó không phải kế hoạch cho riêng Paseo; nó là cách tổ chức bất kỳ hệ thống orchestration nào sao cho doctrine của bạn có thể cài vào, gỡ ra, thay thế, và tốt lên vài phần trăm mỗi tuần.

## Kernel phải mở cái gì

Để một workflow như SLP sống được như plugin, kernel phải mở đúng những điểm mà SLP hiện đang chọc vào lõi. Không nhiều hơn.

Một, instruction injection qua kênh bền: plugin cần đặt một khối chỉ dẫn vào đúng chỗ provider giữ nó qua compact và resume, và kernel phải đảm bảo khối đó đến được model, bằng một receipt, không phải bằng preflight của transport. Đây là thứ nhóm gọi là "common-channel proof", và nó là yêu cầu đúng, chỉ cần nó là hook thay vì code trong lõi.

Hai, tool ceiling theo tên: plugin khai báo agent nào được thấy tool nào; kernel lọc. Kernel không cần biết "lead" nghĩa là gì; nó chỉ cần biết agent này thuộc nhóm ceiling này.

Ba, phong bì tạo agent có metadata tùy ý và validation hook: khi tạo agent, plugin được kiểm tra và bổ sung metadata, được từ chối launch với lý do. Vai, disposition, lease, assignment sống ở đây, như dữ liệu của plugin, không phải enum của protocol.

Bốn, event bus với khả năng subscribe theo nghĩa: finish, error, permission, và một hook để plugin cắm bộ phân loại của mình vào luồng output. Đây là cái "model nhỏ đọc luồng" của Demonthorn, và nó chỉ cần một điểm cắm.

Năm, isolation primitive: worktree, thư mục làm việc của session, chế độ chỉ đọc do provider hay OS enforce, với khả năng plugin hỏi "chế độ này có thật không" và kernel trả lời thật thà. Fail-closed lúc đó là quyết định của plugin, dựa trên câu trả lời của kernel.

Sáu, state hook: plugin được lưu và đọc lại một ít trạng thái gắn với agent hay workspace, ví dụ nhãn council, digest protocol, receipt của lần đọc protocol gần nhất. Không phải database riêng; một key-value có version.

Kernel mở sáu điểm này thì SLP, hay bất kỳ doctrine nào khác, cài được. Kernel không mở thì mọi doctrine phải fork.

## Plugin sở hữu cái gì

Tất cả những gì opinionated: tên và số vai; ba lớp chỉ dẫn và template của chúng; quy tắc ai đọc protocol; phong bì assignment; trần tool theo vai; council với ghế, vòng và verdict; handoff và thay Lead; điều khoản tracker, nếu có, và mức bắt buộc của nó; danh sách anti-pattern; bộ phân loại attention và các event tùy chỉnh; và quan trọng nhất, phiên bản của chính nó.

Một doctrine có version là một doctrine tiến hóa được. "Better SLP" hàng tuần của thầy trở thành: đọc sổ Supervisor, sửa vài dòng trong plugin, tăng version, chạy lại cùng bộ task đối chứng, giữ hoặc rollback. Không ai phải chạm vào kernel. Không ai phải merge năm mươi xung đột.

## Đường di cư

Không đập đi làm lại. Chiến lược "strangler": mỗi lần chạm vào một mảnh SLP trong lõi, dời nó ra sau một hook, cho tới khi lõi không còn biết chữ "lead".

Bắt đầu bằng enum vai: thay bằng registry do plugin đăng ký; contract version chuyển vào manifest của plugin, kernel chỉ kiểm rằng manifest hợp lệ, không kiểm nội dung. Tiếp theo là chuỗi điều khoản tracker sinh trong lõi: chuyển thành đoạn chỉ dẫn do plugin cung cấp qua hook injection, với mức bắt buộc là một cấu hình của plugin, để side project chọn lỏng. Rồi tới trần tool: từ switch theo tên vai thành bảng do plugin khai báo. Rồi council case store: từ module trong daemon thành state của plugin trên state hook. Rồi bộ lọc skill: từ danh sách hard-code thành khai báo của plugin. Mỗi bước có thể là một release nhỏ, có canary, có rollback. Và mỗi bước giảm số dòng xung đột ở lần merge upstream kế tiếp, tức bạn đo được tiến bộ bằng một con số mà cả đội hiểu.

Có hai cạm bẫy trên đường. Thứ nhất là cầu tạm: mỗi bước dời sẽ cám dỗ giữ đường cũ "cho tương thích". Áp dụng hard cut nội bộ: một đường sống, xóa đường cũ trong cùng bước, viết lại test ở ranh giới mới. Thứ hai là "lean mode": thêm một công tắc tắt SLP mà không tách lớp; đó là escape hatch, không phải extension, và nó sẽ thành một đường code nữa để bảo trì.

## Cái mất và cái được

Nói thật về cái giá. Plugin hóa SLP làm mất một thứ: cảm giác an toàn của fail-closed nằm trong lõi. Khi vai là dữ liệu, một plugin sai có thể tạo agent không có vai. Câu trả lời không phải nhét vai lại vào lõi; câu trả lời là kernel có một hook validation, và plugin SLP dùng hook đó để từ chối launch không có vai, với cùng độ nghiêm ngặt như trước. Enforcement không mất; nó đổi chỗ sang lớp có chủ.

Cái được thì nhiều hơn. Merge upstream trở thành việc thường. Người khác dùng được kernel với doctrine của họ, hoặc không doctrine nào. Doctrine của bạn có version và có thể tốt lên mỗi tuần. Và quan trọng hơn cả với chủ đề cuốn sách: quyết định "hệ thống này tổ chức đội agent thế nào" quay về có chủ. Chủ của nó là người vận hành, người có thể tắt, thay, hoặc tiến hóa nó. Không phải một enum ở tầng protocol.

## Bài học cho người không dùng Paseo

Bạn có thể đang dùng một công cụ khác, hay tự xây. Ba câu hỏi để kiểm tra mình có đang dán SIM vào máy không. Một: nếu tôi đổi tên hoặc thêm một vai, bao nhiêu file ngoài thư mục "workflow" phải đổi? Hai: nếu một người khác muốn chạy công cụ này với cách tổ chức đội khác hẳn, họ có làm được mà không fork không? Ba: nếu tôi bỏ doctrine hiện tại, cái gì còn lại có chạy được không? Trả lời thật, và bạn biết mình đang ở đâu.

> Kernel mở sáu điểm; plugin sở hữu mọi thứ opinionated, kể cả version của chính nó. Di cư từng mảnh, không cầu tạm, không lean mode. Đo tiến bộ bằng số xung đột ở lần merge sau.


# Phần VI — Vận hành

# Chương 20. Bắt đầu nhỏ, lớn theo bằng chứng

Không ai mở tám căn bếp trong một đêm. Người có tám căn bếp bắt đầu bằng một, học cách nếm mà không nấu, rồi thêm căn thứ hai khi căn thứ nhất không cần mình nữa. Giáo án đầu tiên của Demonthorn kết thúc bằng một lộ trình năm giai đoạn, và tôi thấy nó vẫn là lộ trình đúng, chỉ cần cập nhật vài chỗ theo những gì đã học ở Phần V.

## Bảng chọn cỡ

Trước mỗi việc, một câu hỏi: cỡ nào?

Việc nhỏ, kết thúc ngay, không chạm hệ thống, ví dụ một landing page cho buổi thuyết trình sáng mai: một session, vài prompt. Không SLP.

Việc nhỏ nhưng chạm hệ thống: đưa cho Lead, Lead giao một Peer và tự review. Lead chịu trách nhiệm, và bạn có một lớp kiểm tra mà không phải tự làm.

Việc có quyết định khó, nhiều lời giải cùng đúng, hoặc domain bạn chưa tự tin phản biện: Lead với hai ba lane thiết kế mù, hội tụ, bạn xem concept, rồi implement.

Việc dài, nhiều ngày, hoặc nhiều project cùng lúc, hoặc bạn muốn đi ngủ trong lúc nó chạy: cả bộ máy, với Supervisor được đánh thức bằng event.

Và một quy tắc xuyên suốt: đừng tin câu trả lời đầu tiên của bất kỳ session nào cho một quyết định quan trọng. Hai lane rẻ hơn một lần làm lại.

## Chưa có công cụ thì làm thế nào

Bạn không cần control plane để bắt đầu. Cách thầy làm nhiều năm trước khi có Paseo: mở session A, hỏi thiết kế. Mở session B, dán câu trả lời của A, hỏi "ý mày thế nào, industry ngoài kia làm thế nào". Dán B ngược lại cho A. Lúc đó bạn đang là Lead, và hai session là hai lane. Khi domain lạ, session A sẽ hỏi ngược bạn nhiều thứ bạn không biết; thầy khuyên "đừng hỏi ngược lại nó, nó bị loãng"; mở session mới và hỏi ở đó. Kênh hỏi đáp và kênh làm việc tách nhau, ngay cả khi cả hai chỉ là tab trình duyệt.

Cách này thô và tốn tay. Nó dạy bạn đúng cơ chế trước khi bạn mua công cụ, và người đã làm nó bằng tay sẽ biết công cụ nào đang bán "solution" thay vì "điện thoại".

## Lộ trình

Giai đoạn một, tối thiểu khả dụng: một Lead, một Peer có write scope, một Peer chỉ đọc khi cần góc nhìn thứ hai, một protocol điều phối duy nhất, quyền edit rõ, trạng thái cơ bản, context pack dạng text, và tắt sub-agent native. Mục tiêu duy nhất: kiểm tra Lead có giao việc bằng câu hỏi mở không, Peer có giữ được năng lực của một main agent không, và quyền hạn có xung đột không. Chưa có Supervisor. Chưa có council. Chưa có tracker bắt buộc.

Giai đoạn hai, chuẩn hóa: ba profile mỏng; một danh sách anti-pattern chung mười tới hai mươi dòng; quy tắc một writer; lock cho test nặng; định nghĩa "done"; reconcile sau mỗi vài task; Reviewer khi rủi ro yêu cầu. Và một protocol mỏng cho repo quan trọng nhất, khoảng mười điều khoản, mỗi điều khoản có lý do và trigger review.

Giai đoạn ba, telemetry và event: context còn lại, số lần compact, cache nóng hay nguội, và quan trọng nhất, canary chứng minh "con xong thì cha thức". Lúc này mới thêm Supervisor, với heartbeat mười lăm phút, chỉ bật khi project đang rối.

Giai đoạn bốn, tối ưu liên tục: sổ Supervisor bằng nguyên nhân; Better SLP mỗi tuần; bộ phân loại rẻ cắm vào luồng output để đánh thức Supervisor theo nghĩa thay vì theo lịch; thí nghiệm có đối chứng trước mỗi điều khoản bắt buộc mới. Và một ngân sách byte cho mọi file chỉ dẫn, enforce bằng CI từ ngày này.

Giai đoạn năm, nhiều project: một Supervisor nhìn ngang nhiều Lead; mỗi Lead giữ project của mình; không trộn ownership; không có Lead chung. Chỉ mở rộng khi workflow một project đã ổn định, và giáo án đầu nói rõ cái giá nếu vội: một ma trận quyền lực không thể quan sát.

Điều tôi cập nhật so với lộ trình gốc: tracker, protocol bắt buộc, validator, và mọi thứ "fail closed" đi vào cuối giai đoạn bốn, không phải giai đoạn hai, và mỗi cái phải qua thí nghiệm đối chứng trước. Phần V đã trả tiền cho bài học đó.

## Đo cái gì

Đo ít, đo thật. Số lần Human phải can thiệp trong một episode. Số lần vi phạm lease, kể cả file sinh ra ngoài phạm vi. Thời gian và token cho một task cùng class, có và không có điều khoản mới. Số lần một quyết định bị mở lại vì mất lịch sử. Số finish event bị thất lạc. Số cầu tạm còn sống sau ba mươi ngày. Số xung đột ở lần merge upstream kế tiếp. Không cần dashboard; một bảng trong sổ Supervisor là đủ, và nó phải có ngày.

Đừng đo số agent, số report, số test. Chúng tăng khi ceremony tăng, và ceremony tăng là điều bạn muốn phát hiện, không phải điều bạn muốn khen.

## Khi nào dừng

Roadmap của nhóm Paseo có một đoạn "điều kiện dừng" mà tôi muốn chép nguyên ý, vì nó hiếm: dừng và quay lại tiền đề khi một mechanism tạo ra owner hay control plane thứ hai, đòi ghi đè sự thật cục bộ, thêm artifact không được task nào dùng, hoặc khi thuế ceremony và bảo trì lớn hơn cái failure lặp lại mà nó giải quyết. Bốn dấu hiệu đó đủ để dừng một sáng kiến trước khi nó hóa đá trong validator.

> Bắt đầu bằng một Lead và một Peer. Thêm mỗi thứ khi có bằng chứng, không khi có ý tưởng. Đo số lần Human phải can thiệp, không đo số agent. Và biết bốn dấu hiệu để dừng.

# Chương 21. Sổ tay ngắn

Chương này để tra, không để đọc liền. Nửa đầu là những câu doctrine đủ ngắn để nhớ. Nửa sau là bốn mẫu đủ ngắn để dùng.

## Những câu để nhớ

1. Cổ chai không còn ở bàn phím; nó ở sự chú ý.
2. Can thiệp rẻ nhất trên đời là một câu hỏi mở đúng lúc.
3. Đừng tin câu trả lời đầu tiên của một cỗ máy sinh tuần tự.
4. Áp lực từ code lớn hơn áp lực từ doc; mười test ngu sẽ đẻ ra cái thứ mười một.
5. Đừng để ai chốt hộ. Một quyết định chỉ được coi là đã chốt khi người có thẩm quyền đóng nó bằng bằng chứng.
6. Model càng mạnh, khinh khí cầu càng đẹp. Trước khi vá, hỏi các finding có hội tụ vào một cái phanh đang thiếu không.
7. Plan này là để agent làm, không phải để người làm; đừng chia slice vì nghe hay.
8. Lead là bộ não có quyền chốt, không phải người phát vé. Nó hỏi mở, giữ framing trong đầu, và không hòa nhã.
9. Đừng cho Lead hỏi yes/no. Peer phải có chỗ để nói "phương án C".
10. Fork không phải ý kiến thứ hai.
11. Independent judgment không phải diễn kịch phản đối; đồng ý là hợp lệ khi bằng chứng ủng hộ.
12. Supervisor có thẩm quyền trên sự chú ý, không có thẩm quyền trên quyết định. Nó hỏi, không phán.
13. Attention trigger chỉ có hai câu: khi nào và như thế nào.
14. Sổ Supervisor ghi nguyên nhân, không ghi khẩu hiệu. Better SLP: mỗi tuần vài phần trăm.
15. Nói với Supervisor, giao cho Lead, học trước khi giao. Bầy cừu không dẫn được bầy sói.
16. Mỗi luật có đúng một nhà. Instruction quá dài bị cắt trong im lặng.
17. Cái nhìn đầu tiên phải độc lập; một trọng tài hội tụ; không bỏ phiếu. Số model đồng ý không tạo ra authority.
18. Một scope đang chuyển động chỉ có một người viết. Chỉ review bản ổn định.
19. Trạng thái không phải nghiệm thu. Unknown là một kết quả hợp lệ.
20. Chờ bằng chuông cửa, và kiểm tra chuông có kêu.
21. Plan là bản đồ tạm; code mới là địa hình.
22. Test bảo vệ contract đã chốt; test không được đẻ ra contract.
23. Cái cầu tạm nào không có ngày chết thì là vĩnh viễn.
24. Ẩn dụ là tay cầm, không phải argument. Đọc từ context tới mechanism tới ví dụ.
25. Đúng ở tầng dưới vẫn có thể vô nghĩa ở tầng đang bàn. Pin proposition trước, rồi mới cãi.
26. Validator là nơi quyết định hóa đá. Giả thuyết ở lớp prose; luật ở lớp công cụ.
27. Nhỏ chưa đủ; đúng chữ mới đủ.
28. Kernel không được biết bạn tin gì. Bán điện thoại, đừng bán điện thoại dán sẵn SIM.
29. Thêm mỗi thứ khi có bằng chứng, không khi có ý tưởng.

## Mẫu 1: phong bì giao việc cho Peer

```text
Project / task:
Disposition: Engineer | Solution Architect | Reviewer | Scout
Workspace hoặc worktree:
Objective (outcome, không phải giải pháp):
Writable scope:
Exclusions:
Authority (edit / commit / push / external effect):
Ràng buộc trích từ protocol của repo (chỉ những gì liên quan):
Escalate: REOPEN_REQUEST khi premise nào sai; DEPENDENCY_REQUEST khi cần gì; BLOCKED khi thiếu gì
Verification (lệnh và kết quả mong đợi):
Handoff: identity của candidate, file đã đổi, lệnh và output, rủi ro, giả định, dependency chưa xong
```

Kiểm tra trước khi gửi: brief có chứa verdict trá hình không? có câu hỏi yes/no nào không? có file list nào được nói như sự thật thay vì tạm thời không?

## Mẫu 2: quan sát của Supervisor

```text
Episode (tên ngắn):
Observation:
Evidence (trích transcript / diff / timeline):
Suspected mechanism (giả thuyết, có thể sai):
Cost / impact:
Câu hỏi mở cho Lead hoặc Peer:
Smallest correction đề xuất:
Escalation needed: yes | no | unknown
Protocol candidate (nếu lặp lại):
```

Gửi khi có evidence. Không gửi khi chỉ có cảm giác. Không bao giờ gửi kèm mệnh lệnh.

## Mẫu 3: report buổi sáng

```text
Trong lúc anh vắng:
- Quyết định lớn nào đã được chốt, bởi ai, có bị phản đối không, phản đối được xử lý thế nào.
- Việc nào đang blocked và cần quyết định của anh (chỉ những việc đó).
- Sự cố: hai lane test song song, xóa nhầm, file ngoài scope, cầu tạm mới.
- Không có gì để nói về những thứ đang khỏe.
Câu hỏi cần anh trả lời hôm nay:
```

## Mẫu 4: kiểm tra trước test đầu tiên của một feature

```text
Yêu cầu gốc (nguyên văn):
Các quyết định chưa có chủ trong yêu cầu này:
  - công thức / đơn vị / làm tròn
  - trường hợp ngược (hoàn, hủy, hết hạn)
  - nơi lưu state, hay derive
  - ai sở hữu boundary này
Ai chốt từng quyết định trên? (Lead / Human / chưa ai)
Nếu "chưa ai": dừng, hỏi. Không viết test.
Nếu đã chốt: interface tối thiểu của boundary là gì?
Test đầu tiên assert ở boundary nào? (không assert vào field nội bộ)
Sau khi contract đổi: test nào cần viết lại, test nào cần xóa, có cầu nào không?
```

# Lời kết. Sói và cừu

Gần cuối buổi talkshow, một bạn hỏi thầy về tương lai: học tư duy quản trị AI thì có khác gì nhau, sinh viên bây giờ prompt còn giỏi hơn giảng viên. Thầy trả lời bằng hình ảnh tôi đã mượn suốt cuốn sách: em là một con sói dẫn một bầy cừu, chứ không thể là bầy cừu đòi dẫn mấy con sói. Muốn quản trị tốt thì phải có năng lực. Bồi đắp tư duy quản trị, và bồi đắp cả bản thân.

Tôi nghĩ đó là câu trả lời đúng cho câu hỏi ẩn sau cả cuốn sách: nếu quyết định phải có chủ, thì chủ phải xứng đáng. Một Lead giỏi không cứu được một Human không biết mình muốn gì. Một Supervisor tinh tường không cứu được một người không đọc report. Một danh sách anti-pattern hai mươi dòng không cứu được người chưa từng thấy pattern đó gây đau. Có một câu thầy nói trong nhóm chat mà tôi thấy đúng với cả người lẫn model: tố chất mạnh nhất của một dev là pattern recognition, và nó chỉ đạt được nếu mình chạm code.

Mọi cơ chế trong sách này, ba vai, ba lớp chỉ dẫn, lane, council, một writer, evidence, event, plugin, đều là cách để giữ cho quyết định có chủ trong một thế giới mà máy móc chốt nhanh hơn người nghĩ. Chúng không thay thế judgment. Chúng bảo vệ chỗ cho judgment. Và chỗ đó chỉ có giá trị khi có người đủ sức đứng vào.

Thầy đọc sách mỗi ngày, sách do model viết theo chủ đề thầy cần, trên điện thoại, lúc chờ agent chạy. Cuốn này là một cuốn như vậy. Nếu nó làm bạn nhớ được ba câu, tôi mong đó là: đừng để ai chốt hộ; test không được đẻ ra contract; và đúng ở tầng dưới vẫn có thể vô nghĩa ở tầng đang bàn.

Còn lại, hãy chạm code, và học mỗi ngày.
