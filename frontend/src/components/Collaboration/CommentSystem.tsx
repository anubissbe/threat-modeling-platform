import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  Alert,
  Badge,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  Reply as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircleOutline as ResolveIcon,
  Undo as UndoIcon,
  Attach as AttachIcon,
  EmojiEmotions as EmojiIcon,
  AlternateEmail as MentionIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { Comment, MentionData, RichTextContent } from '../../types/collaboration';
import { formatDistanceToNow } from 'date-fns';

interface CommentSystemProps {
  threatModelId: string;
  elementId?: string;
  comments?: Comment[];
  onAddComment: (elementId: string, comment: string, position?: { x: number; y: number }) => void;
  onEditComment?: (commentId: string, newContent: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onResolveComment?: (commentId: string) => void;
  onReplyComment?: (commentId: string, reply: string) => void;
  onClose: () => void;
  currentUserId: string;
  currentUsername: string;
  canModerate?: boolean;
  showResolved?: boolean;
  position?: { x: number; y: number };
  className?: string;
}

interface CommentFormData {
  content: string;
  elementId: string;
  mentions: MentionData[];
  isEditing: boolean;
  editingCommentId?: string;
}

const CommentSystem: React.FC<CommentSystemProps> = ({
  threatModelId,
  elementId = '',
  comments = [],
  onAddComment,
  onEditComment,
  onDeleteComment,
  onResolveComment,
  onReplyComment,
  onClose,
  currentUserId,
  currentUsername,
  canModerate = false,
  showResolved = false,
  position,
  className
}) => {
  const [formData, setFormData] = useState<CommentFormData>({
    content: '',
    elementId: elementId,
    mentions: [],
    isEditing: false
  });
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentMenu, setCommentMenu] = useState<{ anchorEl: HTMLElement | null; commentId: string | null }>({
    anchorEl: null,
    commentId: null
  });
  const [filterResolved, setFilterResolved] = useState(!showResolved);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'most_replies'>('newest');

  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const commentListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (commentListRef.current) {
      commentListRef.current.scrollTop = commentListRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) return;

    if (formData.isEditing && formData.editingCommentId) {
      onEditComment?.(formData.editingCommentId, formData.content);
    } else if (replyingTo) {
      onReplyComment?.(replyingTo, formData.content);
      setReplyingTo(null);
    } else {
      onAddComment(formData.elementId, formData.content, position);
    }

    setFormData({
      content: '',
      elementId: elementId,
      mentions: [],
      isEditing: false
    });
  };

  const handleEditComment = (comment: Comment) => {
    setFormData({
      content: comment.content,
      elementId: comment.elementId,
      mentions: [],
      isEditing: true,
      editingCommentId: comment.id
    });
    setCommentMenu({ anchorEl: null, commentId: null });
    textFieldRef.current?.focus();
  };

  const handleDeleteComment = (commentId: string) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      onDeleteComment?.(commentId);
    }
    setCommentMenu({ anchorEl: null, commentId: null });
  };

  const handleResolveComment = (commentId: string) => {
    onResolveComment?.(commentId);
    setCommentMenu({ anchorEl: null, commentId: null });
  };

  const handleReplyClick = (commentId: string) => {
    setReplyingTo(commentId);
    textFieldRef.current?.focus();
  };

  const handleExpandComment = (commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const handleMention = (username: string) => {
    const currentContent = formData.content;
    const newContent = currentContent + `@${username} `;
    setFormData({
      ...formData,
      content: newContent
    });
  };

  const getFilteredComments = () => {
    let filtered = comments;

    if (filterResolved) {
      filtered = filtered.filter(comment => !comment.resolved);
    }

    switch (sortOrder) {
      case 'newest':
        filtered = filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        break;
      case 'oldest':
        filtered = filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        break;
      case 'most_replies':
        filtered = filtered.sort((a, b) => (b.replies?.length || 0) - (a.replies?.length || 0));
        break;
    }

    return filtered;
  };

  const renderCommentMenu = () => {
    if (!commentMenu.anchorEl || !commentMenu.commentId) return null;

    const comment = comments.find(c => c.id === commentMenu.commentId);
    if (!comment) return null;

    const canEdit = comment.userId === currentUserId || canModerate;
    const canDelete = comment.userId === currentUserId || canModerate;

    return (
      <Menu
        anchorEl={commentMenu.anchorEl}
        open={Boolean(commentMenu.anchorEl)}
        onClose={() => setCommentMenu({ anchorEl: null, commentId: null })}
      >
        <MenuItem onClick={() => handleReplyClick(comment.id)}>
          <ReplyIcon sx={{ mr: 1 }} fontSize="small" />
          Reply
        </MenuItem>
        
        {canEdit && (
          <MenuItem onClick={() => handleEditComment(comment)}>
            <EditIcon sx={{ mr: 1 }} fontSize="small" />
            Edit
          </MenuItem>
        )}
        
        {onResolveComment && (
          <MenuItem onClick={() => handleResolveComment(comment.id)}>
            {comment.resolved ? <UndoIcon sx={{ mr: 1 }} fontSize="small" /> : <ResolveIcon sx={{ mr: 1 }} fontSize="small" />}
            {comment.resolved ? 'Unresolve' : 'Resolve'}
          </MenuItem>
        )}
        
        <Divider />
        
        {canDelete && (
          <MenuItem 
            onClick={() => handleDeleteComment(comment.id)}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
            Delete
          </MenuItem>
        )}
      </Menu>
    );
  };

  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const isExpanded = expandedComments.has(comment.id);
    const hasReplies = comment.replies && comment.replies.length > 0;
    const timeSince = formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true });

    return (
      <Box key={comment.id} sx={{ mb: 1 }}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            ml: isReply ? 4 : 0,
            backgroundColor: comment.resolved ? 'action.hover' : 'background.paper',
            borderLeft: comment.resolved ? '4px solid #4caf50' : 'none'
          }}
        >
          <Box display="flex" alignItems="flex-start">
            <Avatar
              src={comment.avatar || undefined}
              sx={{ width: 32, height: 32, mr: 2 }}
            >
              {comment.username.charAt(0).toUpperCase()}
            </Avatar>
            
            <Box flexGrow={1}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  <Typography variant="body2" fontWeight="medium">
                    {comment.username}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {timeSince}
                  </Typography>
                  {comment.resolved && (
                    <Chip
                      label="Resolved"
                      size="small"
                      color="success"
                      sx={{ ml: 1, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
                
                <IconButton
                  size="small"
                  onClick={(e) => setCommentMenu({ anchorEl: e.currentTarget, commentId: comment.id })}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
              
              <Typography variant="body2" sx={{ mt: 1, mb: 1 }}>
                {comment.content}
              </Typography>
              
              <Box display="flex" alignItems="center" gap={1}>
                <Button
                  size="small"
                  startIcon={<ReplyIcon />}
                  onClick={() => handleReplyClick(comment.id)}
                  disabled={comment.resolved}
                >
                  Reply
                </Button>
                
                {hasReplies && (
                  <Button
                    size="small"
                    onClick={() => handleExpandComment(comment.id)}
                  >
                    {isExpanded ? 'Hide' : 'Show'} {comment.replies!.length} replies
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        </Paper>
        
        {hasReplies && isExpanded && (
          <Box sx={{ mt: 1 }}>
            {comment.replies!.map(reply => renderComment(reply, true))}
          </Box>
        )}
      </Box>
    );
  };

  const filteredComments = getFilteredComments();

  return (
    <Paper
      className={className}
      sx={{
        position: 'fixed',
        top: position?.y || 100,
        right: position?.x || 20,
        width: 400,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1300,
        ...(position && {
          position: 'absolute',
          top: position.y,
          left: position.x
        })
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box display="flex" alignItems="center">
          <Typography variant="h6">
            Comments
          </Typography>
          {comments.length > 0 && (
            <Badge badgeContent={comments.length} color="primary" sx={{ ml: 2 }} />
          )}
        </Box>
        
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Filters */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Chip
            label="Hide resolved"
            size="small"
            color={filterResolved ? 'primary' : 'default'}
            onClick={() => setFilterResolved(!filterResolved)}
          />
          <Chip
            label="Newest first"
            size="small"
            color={sortOrder === 'newest' ? 'primary' : 'default'}
            onClick={() => setSortOrder('newest')}
          />
          <Chip
            label="Oldest first"
            size="small"
            color={sortOrder === 'oldest' ? 'primary' : 'default'}
            onClick={() => setSortOrder('oldest')}
          />
        </Box>
      </Box>

      {/* Comments List */}
      <Box
        ref={commentListRef}
        sx={{
          flexGrow: 1,
          p: 2,
          overflow: 'auto',
          maxHeight: '400px'
        }}
      >
        {filteredComments.length === 0 ? (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            sx={{ py: 4 }}
          >
            <Typography variant="body2" color="text.secondary">
              No comments yet. Be the first to comment!
            </Typography>
          </Box>
        ) : (
          filteredComments.map(comment => renderComment(comment))
        )}
      </Box>

      {/* Comment Form */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        {replyingTo && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <IconButton size="small" onClick={() => setReplyingTo(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            Replying to comment
          </Alert>
        )}
        
        {formData.isEditing && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <IconButton 
                size="small" 
                onClick={() => setFormData({ ...formData, isEditing: false, editingCommentId: undefined })}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            Editing comment
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <TextField
            ref={textFieldRef}
            fullWidth
            multiline
            maxRows={4}
            placeholder="Add a comment..."
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Mention user">
                    <IconButton size="small" onClick={() => handleMention('')}>
                      <MentionIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Add emoji">
                    <IconButton size="small">
                      <EmojiIcon />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
          />
          
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {formData.content.length}/1000 characters
            </Typography>
            
            <Box display="flex" gap={1}>
              <Button
                size="small"
                onClick={() => {
                  setFormData({ content: '', elementId: '', mentions: [], isEditing: false });
                  setReplyingTo(null);
                }}
                disabled={!formData.content.trim()}
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                size="small"
                variant="contained"
                startIcon={<SendIcon />}
                disabled={!formData.content.trim()}
              >
                {formData.isEditing ? 'Update' : replyingTo ? 'Reply' : 'Comment'}
              </Button>
            </Box>
          </Box>
        </form>
      </Box>

      {renderCommentMenu()}
    </Paper>
  );
};

export default CommentSystem;