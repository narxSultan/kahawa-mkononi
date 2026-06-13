import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/feedback_provider.dart';
import '../../utils/formatters.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/empty_view.dart';
import '../../widgets/error_view.dart';
import '../../widgets/loading_view.dart';

class FeedbackScreen extends ConsumerStatefulWidget {
  final String? orderId;
  const FeedbackScreen({super.key, this.orderId});

  @override
  ConsumerState<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends ConsumerState<FeedbackScreen> {
  int _rating = 5;
  final _comment = TextEditingController();
  bool _saving = false;
  String? _err;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(feedbackProvider);
    return Scaffold(
      appBar: const BrandedAppBar(title: Text('Feedback')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Rate your experience', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                      if (widget.orderId != null) ...[
                        const SizedBox(height: 6),
                        Text('Order: ${widget.orderId}', style: const TextStyle(color: Colors.black54)),
                      ],
                      const SizedBox(height: 10),
                      Row(
                        children: List.generate(
                          5,
                          (i) => IconButton(
                            onPressed: _saving ? null : () => setState(() => _rating = i + 1),
                            icon: Icon(i < _rating ? Icons.star : Icons.star_border),
                            color: const Color(0xFFFFB300),
                          ),
                        ),
                      ),
                      TextField(
                        controller: _comment,
                        maxLines: 3,
                        decoration: const InputDecoration(labelText: 'Comment (optional)', prefixIcon: Icon(Icons.chat_bubble_outline)),
                      ),
                      if (_err != null) ...[
                        const SizedBox(height: 8),
                        Text(_err!, style: const TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w700)),
                      ],
                      const SizedBox(height: 10),
                      ElevatedButton.icon(
                        onPressed: _saving
                            ? null
                            : () async {
                                setState(() {
                                  _saving = true;
                                  _err = null;
                                });
                                try {
                                  await ref.read(feedbackProvider.notifier).submit(orderId: widget.orderId, rating: _rating, comment: _comment.text);
                                  _comment.clear();
                                  if (!context.mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Feedback sent')));
                                } catch (e) {
                                  if (!mounted) return;
                                  setState(() => _err = e.toString());
                                } finally {
                                  if (mounted) setState(() => _saving = false);
                                }
                              },
                        icon: const Icon(Icons.send_outlined),
                        label: Text(_saving ? 'Sending...' : 'Submit'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
              child: Align(alignment: Alignment.centerLeft, child: Text('My feedback history', style: TextStyle(fontWeight: FontWeight.w900))),
            ),
            Expanded(
              child: list.when(
                loading: () => const LoadingView(),
                error: (e, _) => ErrorView(title: 'Failed to load feedback', details: e.toString(), onRetry: () => ref.read(feedbackProvider.notifier).reload()),
                data: (rows) {
                  if (rows.isEmpty) return const EmptyView(title: 'No feedback yet', subtitle: 'Your ratings will appear here.');
                  return RefreshIndicator(
                    onRefresh: () async => ref.read(feedbackProvider.notifier).reload(),
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final f = rows[i];
                        return Card(
                          child: ListTile(
                            title: Text('Rating: ${f.rating}/5', style: const TextStyle(fontWeight: FontWeight.w900)),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text(Formatters.dateTime(f.createdAt), style: const TextStyle(color: Colors.black54)),
                                if ((f.comment ?? '').trim().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(f.comment!)),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
