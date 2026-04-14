import { Text, TouchableOpacity, View } from 'react-native';

interface ListHeadingProps {
  title: string;
  onPress?: () => void;
}

const ListHeading = ({ title, onPress }: ListHeadingProps) => {
  return (
    <View className="list-head">
      <Text className="list-title">{title}</Text>

      <TouchableOpacity className="list-action" onPress={onPress}>
        <Text className="list-action-text">View all</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ListHeading;
